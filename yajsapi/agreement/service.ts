import Bottleneck from "bottleneck";

import { Logger } from "../utils/index.js";
import { Agreement, AgreementOptions, AgreementStateEnum } from "./agreement.js";
import sleep from "../utils/sleep.js";

import { ComputationHistory, MarketStrategy } from "../market/strategy.js";
import { AgreementServiceConfig } from "./config.js";
import { Proposal } from "../market/proposal.js";

export class AgreementCandidate {
  agreement?: Agreement;
  constructor(readonly proposal: Proposal) {}
}

export interface AgreementServiceOptions extends AgreementOptions {
  marketStrategy?: MarketStrategy;
  agreementEventPoolingInterval?: number;
  agreementEventPoolingMaxEventsPerRequest?: number;
  agreementWaitingForProposalTimout?: number;
}

export interface AgreementProposal {
  proposalId: string;
}

/**
 * Agreement Pool Service
 * @description Service used in {@link TaskExecutor}
 * @hidden
 */
export class AgreementPoolService implements ComputationHistory {
  private logger?: Logger;
  private config: AgreementServiceConfig;

  private pool = new Set<AgreementCandidate>();
  private candidateMap = new Map<Agreement, AgreementCandidate>();

  private isServiceRunning = false;
  private initialTime = Date.now();
  private limiter: Bottleneck;

  constructor(private readonly agreementServiceOptions?: AgreementServiceOptions) {
    this.config = new AgreementServiceConfig(agreementServiceOptions);
    this.logger = agreementServiceOptions?.logger;

    this.limiter = new Bottleneck({
      maxConcurrent: 1,
    });
  }

  /**
   * Start AgreementService
   */
  async run() {
    this.isServiceRunning = true;
    this.initialTime = +new Date();
    this.logger?.debug("Agreement Pool Service has started");
  }

  /**
   * Add proposal for create agreement purposes
   * @param proposal Proposal
   */
  async addProposal(proposal: Proposal) {
    if (!(await this.config.marketStrategy.checkProposal(proposal))) {
      this.logger?.info("Proposal has been rejected by market strategy");
      return;
    }
    this.logger?.info(`New proposal added to pool (${proposal.id})`);
    this.pool.add(new AgreementCandidate(proposal));
  }

  /**
   * Release or terminate agreement by ID
   *
   * @param agreement Agreement
   * @param allowReuse if false, terminate and remove from pool, if true, back to pool for further reuse
   */
  async releaseAgreement(agreement: Agreement, allowReuse: boolean) {
    if (allowReuse) {
      const candidate = this.candidateMap.get(agreement);
      if (candidate) {
        this.pool.add(candidate);
        this.logger?.debug(`Agreement ${agreement.id} has been released for reuse`);
      } else {
        this.logger?.debug(`Agreement ${agreement.id} has been released for but not added to poo for reuse`);
      }
    } else {
      this.logger?.debug(`Agreement ${agreement.id} has been released and removed from pool`);
    }
  }

  /**
   * Get agreement ready for use
   * @description Return available agreement from pool, or create a new one
   * @return Agreement
   */
  async getAgreement(): Promise<Agreement> {
    let agreement;
    while (!agreement && this.isServiceRunning) {
      agreement = await this.getAgreementFormPool();
      if (!agreement) {
        await sleep(2);
      }
    }

    if (!agreement && !this.isServiceRunning) {
      throw new Error("Unable to get agreement. Agreement service is not running");
    }

    return agreement;
  }

  private cleanupPool() {
    const toCleanup = Array.from(this.pool).filter((e) => !!e.agreement);
    console.log("cleanupPool", toCleanup);
  }

  private async getAgreementFormPool(): Promise<Agreement | undefined> {
    this.cleanupPool();

    if (this.pool.size === 0) {
      this.logger?.debug(`Agreement cannot be created due to no available candidates in pool`);
      return;
    }

    let candidate = await this.limiter.schedule(() => {
      const pool = Array.from(this.pool);
      return this.config.marketStrategy.getBestAgreementCandidate(pool);
    });
    this.pool.delete(candidate);

    if (candidate && !candidate?.agreement) {
      candidate = await this.createAgreement(candidate);
    }

    return candidate?.agreement;
  }

  /**
   * Stop the service
   */
  async end() {
    this.isServiceRunning = false;
    await this.terminateAll({ message: "All computations done" });
    this.logger?.debug("Agreement Pool Service has been stopped");
  }

  /**
   * Terminate all agreements
   * @param reason
   */
  async terminateAll(reason?: { [key: string]: string }) {
    this.logger?.info(`Terminate all agreements was called`);
    for (const [agreement] of Array.from(this.candidateMap)) {
      if ((await agreement.getState()) !== AgreementStateEnum.Terminated)
        await agreement
          .terminate(reason)
          .catch((e) => this.logger?.warn(`Agreement ${agreement.id} cannot be terminated. ${e}`));
    }
  }

  async createAgreement(candidate) {
    try {
      candidate.agreement = await Agreement.create(candidate.proposal.id, this.config.options);
      candidate.agreement = await this.waitForAgreementApproval(candidate.agreement);
      const state = await candidate.agreement.getState();

      if (state !== AgreementStateEnum.Approved) {
        throw new Error(`Agreement ${candidate.agreement.id} cannot be approved. Current state: ${state}`);
      }
      this.logger?.info(`Agreement confirmed by provider ${candidate.agreement.provider.name}`);
      this.candidateMap.set(candidate.agreement, candidate);

      return candidate;
    } catch (e) {
      this.logger?.error(`Unable to create agreement form available proposal: ${e?.data?.message || e}`);
      await sleep(2);
      return;
    }
  }

  private async waitForAgreementApproval(agreement: Agreement) {
    const state = await agreement.getState();

    if (state === AgreementStateEnum.Proposal) {
      await agreement.confirm();
      this.logger?.debug(`Agreement proposed to provider '${agreement.provider.name}'`);
    }

    await this.config.api.waitForApproval(agreement.id, this.config.agreementWaitingForApprovalTimeout);
    return agreement;
  }
}
