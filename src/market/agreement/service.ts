import Bottleneck from "bottleneck";
import { defaultLogger, Logger, sleep, YagnaApi } from "../../shared/utils";
import { Agreement, IAgreementApi, LegacyAgreementServiceOptions } from "./agreement";
import { AgreementServiceConfig } from "./config";
import { GolemMarketError, MarketErrorCode, OfferProposal } from "../index";

export interface AgreementDTO {
  id: string;
  provider: { id: string; name: string };
}

export class AgreementCandidate {
  agreement?: AgreementDTO;

  constructor(readonly proposal: OfferProposal) {}
}

export type AgreementSelector = (candidates: AgreementCandidate[]) => Promise<AgreementCandidate>;

export interface AgreementServiceOptions extends LegacyAgreementServiceOptions {
  /** The selector used when choosing a provider from a pool of existing offers (from the market or already used before) */
  agreementSelector?: AgreementSelector;
  /** The maximum number of events fetched in one request call  */
  agreementMaxEvents?: number;
  /** interval for fetching agreement events */
  agreementEventsFetchingIntervalSec?: number;
  /** The maximum number of agreements stored in the pool */
  agreementMaxPoolSize?: number;
}

/**
 * Agreement Pool Service
 * @description Service used in {@link TaskExecutor}
 * @hidden
 *
 * @deprecated This class is removed and - move to AgreementPool.acquire
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
    private readonly agreementApi: IAgreementApi,
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
  async addProposal(proposal: OfferProposal) {
    // TODO: this.logger.debug(`New proposal added to pool`, { providerName: proposal.provider.name });
    this.pool.add(new AgreementCandidate(proposal));
  }

  /**
   * Release or terminate agreement by ID
   *
   * @param agreementId Agreement Id
   * @param allowReuse if false, terminate and remove from pool, if true, back to pool for further reuse
   */
  async releaseAgreement(agreementId: string, allowReuse: boolean) {
    const agreementsInPool = Array.from(this.pool).filter((a) => a.agreement);
    const isPoolFull = agreementsInPool.length >= this.config.agreementMaxPoolSize;
    if (allowReuse && isPoolFull) {
      this.logger.debug(`Agreement cannot return to the pool because the pool is already full`, {
        id: agreementId,
      });
    }
    if (allowReuse && !isPoolFull) {
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
        await this.agreementApi.terminateAgreement(agreement, "Finished");
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
      throw new GolemMarketError(
        "Unable to get agreement. Agreement service is not running",
        MarketErrorCode.ServiceNotInitialized,
      );
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
    await this.terminateAll();
    this.logger.info("Agreement Pool Service has been stopped");
  }

  /**
   * Terminate all agreements
   */
  async terminateAll() {
    const agreementsToTerminate = Array.from(this.candidateMap)
      .map(([agreementId]) => this.agreements.get(agreementId))
      .filter((a) => a !== undefined) as Agreement[];
    this.logger.debug(`Trying to terminate all agreements....`, { size: agreementsToTerminate.length });
    await Promise.all(
      agreementsToTerminate.map((agreement) =>
        this.agreementApi
          .terminateAgreement(agreement, "Finished")
          .catch((e) => this.logger.warn(`Agreement cannot be terminated.`, { id: agreement.id, error: e })),
      ),
    );
  }

  async createAgreement(candidate: AgreementCandidate) {
    try {
      const agreement = await this.agreementApi.createAgreement(candidate.proposal);
      const state = agreement.getState();

      if (state !== "Approved") {
        throw new GolemMarketError(
          `Agreement ${agreement.id} cannot be approved. Current state: ${state}`,
          MarketErrorCode.AgreementApprovalFailed,
        );
      }
      this.logger.info(`Agreement confirmed by provider`, { providerName: agreement.getProviderInfo().name });

      this.agreements.set(agreement.id, agreement);

      candidate.agreement = {
        id: agreement.id,
        provider: agreement.getProviderInfo(),
      };

      this.candidateMap.set(agreement.id, candidate);

      return agreement;
    } catch (err) {
      this.logger.error(`Unable to create agreement form available proposal`, err);
      await sleep(2);
      return;
    }
  }

  private async subscribeForAgreementEvents() {
    this.yagnaApi.agreementEvents$.subscribe((event) => {
      this.logger.debug("Received agreement operation event", { event });
      if (event) {
        if (event.eventType === "AgreementTerminatedEvent" && "reason" in event) {
          this.handleTerminationAgreementEvent(
            event.agreementId,
            event.reason?.message ?? "Received AgreementTerminatedEvent from Yagna",
          );
        }
      }
    });
  }

  private async handleTerminationAgreementEvent(agreementId: string, reason: string) {
    const agreement = this.agreements.get(agreementId);
    if (agreement) {
      await this.agreementApi.terminateAgreement(agreement, reason);
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
