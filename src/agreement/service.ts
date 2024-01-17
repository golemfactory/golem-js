import Bottleneck from "bottleneck";
import { Logger, YagnaApi, defaultLogger, sleep } from "../utils";
import { Agreement, AgreementOptions, AgreementStateEnum } from "./agreement";
import { AgreementServiceConfig } from "./config";
import { Proposal } from "../market";
import { AgreementEvent, AgreementTerminatedEvent } from "ya-ts-client/dist/ya-market";
import { GolemError } from "../error/golem-error";

export interface AgreementDTO {
  id: string;
  provider: { id: string; name: string };
}

export class AgreementCandidate {
  agreement?: AgreementDTO;
  constructor(readonly proposal: Proposal) {}
}

export type AgreementSelector = (candidates: AgreementCandidate[]) => Promise<AgreementCandidate>;

export interface AgreementServiceOptions extends AgreementOptions {
  /** The selector used when choosing a provider from a pool of existing offers (from the market or already used before) */
  agreementSelector?: AgreementSelector;
  /** The maximum number of events fetched in one request call  */
  agreementMaxEvents?: number;
  /** interval for fetching agreement events */
  agreementEventsFetchingIntervalSec?: number;
}

/**
 * Agreement Pool Service
 * @description Service used in {@link TaskExecutor}
 * @hidden
 */
export class AgreementPoolService {
  private logger: Logger;
  private config: AgreementServiceConfig;
  private pool = new Set<AgreementCandidate>();
  private candidateMap = new Map<string, AgreementCandidate>();
  private agreements = new Map<string, Agreement>();
  private isServiceRunning = false;
  private limiter: Bottleneck;

  constructor(
    private readonly yagnaApi: YagnaApi,
    agreementServiceOptions?: AgreementServiceOptions,
  ) {
    this.config = new AgreementServiceConfig(agreementServiceOptions);
    this.logger = agreementServiceOptions?.logger || defaultLogger("agreement");
    this.limiter = new Bottleneck({
      maxConcurrent: 1,
    });
  }

  /**
   * Start AgreementService
   */
  async run() {
    this.isServiceRunning = true;
    this.subscribeForAgreementEvents().catch((e) => this.logger.warn("Unable to subscribe for agreement events", e));
    this.logger.info("Agreement Pool Service has started");
  }

  /**
   * Add proposal for create agreement purposes
   * @param proposal Proposal
   */
  async addProposal(proposal: Proposal) {
    this.logger.debug(`New proposal added to pool`, { providerName: proposal.provider.name });
    this.pool.add(new AgreementCandidate(proposal));
  }

  /**
   * Release or terminate agreement by ID
   *
   * @param agreementId Agreement Id
   * @param allowReuse if false, terminate and remove from pool, if true, back to pool for further reuse
   */
  async releaseAgreement(agreementId: string, allowReuse: boolean) {
    if (allowReuse) {
      const candidate = this.candidateMap.get(agreementId);
      if (candidate) {
        this.pool.add(candidate);
        this.logger.debug(`Agreement has been released for reuse`, { id: agreementId });
        return;
      } else {
        this.logger.debug(`Agreement not found in the pool`, { id: agreementId });
      }
    } else {
      const agreement = this.agreements.get(agreementId);
      if (!agreement) {
        this.logger.debug(`Agreement not found in the pool`, { id: agreementId });
        return;
      }
      this.logger.debug(`Agreement has been released and will be terminated`, { id: agreementId });
      try {
        this.removeAgreementFromPool(agreement);
        await agreement.terminate();
      } catch (e) {
        this.logger.warn(`Unable to terminate agreement`, { id: agreementId, error: e });
      }
    }
  }

  /**
   * Get agreement ready for use
   * @description Return available agreement from pool, or create a new one
   * @return Agreement
   */
  async getAgreement(): Promise<Agreement> {
    let agreement: Agreement | undefined;
    while (!agreement && this.isServiceRunning) {
      agreement = await this.getAgreementFormPool();
      if (!agreement) {
        await sleep(2);
      }
    }
    if (!agreement || !this.isServiceRunning) {
      throw new GolemError("Unable to get agreement. Agreement service is not running");
    }
    return agreement;
  }

  private async getAgreementFormPool(): Promise<Agreement | undefined> {
    // Limit concurrency to 1
    const candidate = await this.limiter.schedule(async () => {
      if (this.pool.size === 0) return;
      const candidates = Array.from(this.pool);
      const bestCandidate = await this.config.agreementSelector(candidates);
      this.pool.delete(bestCandidate);
      return bestCandidate;
    });

    // If candidate is not present, return empty
    if (!candidate) {
      return;
    }

    // If agreement is created return agreement
    if (candidate?.agreement?.id) {
      return this.agreements.get(candidate?.agreement?.id);
    }

    // If agreement is not created, then create agreement and return new agreement
    if (candidate && !candidate?.agreement) {
      return await this.createAgreement(candidate);
    }
  }

  /**
   * Stop the service
   */
  async end() {
    this.isServiceRunning = false;
    await this.terminateAll({ message: "All computations done" });
    this.logger.info("Agreement Pool Service has been stopped");
  }

  /**
   * Terminate all agreements
   * @param reason
   */
  async terminateAll(reason?: { [key: string]: string }) {
    const agreementsToTerminate = Array.from(this.candidateMap)
      .map(([agreementId]) => this.agreements.get(agreementId))
      .filter((a) => a !== undefined) as Agreement[];
    this.logger.debug(`Trying to terminate all agreements....`, { size: agreementsToTerminate.length });
    await Promise.all(
      agreementsToTerminate.map((agreement) =>
        agreement
          .terminate(reason)
          .catch((e) => this.logger.warn(`Agreement cannot be terminated.`, { id: agreement.id, error: e })),
      ),
    );
  }

  async createAgreement(candidate: AgreementCandidate) {
    try {
      let agreement = await Agreement.create(candidate.proposal.id, this.yagnaApi, this.config.options);
      agreement = await this.waitForAgreementApproval(agreement);
      const state = await agreement.getState();

      if (state !== AgreementStateEnum.Approved) {
        throw new GolemError(`Agreement ${agreement.id} cannot be approved. Current state: ${state}`);
      }
      this.logger.info(`Agreement confirmed by provider`, { providerName: agreement.provider.name });

      this.agreements.set(agreement.id, agreement);

      candidate.agreement = {
        id: agreement.id,
        provider: { id: agreement.provider.id, name: agreement.provider.name },
      };

      this.candidateMap.set(agreement.id, candidate);

      return agreement;
    } catch (e) {
      this.logger.debug(`Unable to create agreement form available proposal`, e);
      await sleep(2);
      return;
    }
  }

  private async waitForAgreementApproval(agreement: Agreement) {
    const state = await agreement.getState();

    if (state === AgreementStateEnum.Proposal) {
      await agreement.confirm(this.yagnaApi.appSessionId);
      this.logger.debug(`Agreement proposed to provider`, { providerName: agreement.provider.name });
    }

    await this.yagnaApi.market.waitForApproval(agreement.id, this.config.agreementWaitingForApprovalTimeout);
    return agreement;
  }

  private async subscribeForAgreementEvents() {
    let afterTimestamp: string | undefined;
    while (this.isServiceRunning) {
      try {
        // @ts-expect-error Bug in ts-client typing
        const { data: events }: { data: Array<AgreementEvent & AgreementTerminatedEvent> } =
          await this.yagnaApi.market.collectAgreementEvents(
            this.config.agreementEventsFetchingIntervalSec,
            afterTimestamp,
            this.config.agreementMaxEvents,
            this.yagnaApi.appSessionId,
          );
        events.forEach((event) => {
          afterTimestamp = event.eventDate;
          // @ts-expect-error: Bug in ya-tsclient: typo in eventtype
          if (event.eventtype === "AgreementTerminatedEvent") {
            this.handleTerminationAgreementEvent(event.agreementId, event.reason);
          }
        });
      } catch (error) {
        this.logger.debug(`Unable to get agreement events.`, error);
        await sleep(2);
      }
    }
  }

  private async handleTerminationAgreementEvent(agreementId: string, reason?: { [key: string]: string }) {
    const agreement = this.agreements.get(agreementId);
    if (agreement) {
      await agreement.terminate(reason);
      this.removeAgreementFromPool(agreement);
    }
  }

  private removeAgreementFromPool(agreement: Agreement) {
    this.agreements.delete(agreement.id);
    const candidate = this.candidateMap.get(agreement.id);
    if (candidate) {
      this.pool.delete(candidate);
      this.candidateMap.delete(agreement.id);
    }
  }
}
