import Bottleneck from "bottleneck";

import { Logger } from "../utils/index.js";
import { Agreement, AgreementOptions, AgreementStateEnum } from "./agreement.js";
import sleep from "../utils/sleep.js";

import { MarketStrategy } from "../market/strategy.js";
import { AgreementServiceConfig } from "./config.js";
import { Proposal } from "../market/proposal.js";

export interface AgreementDTO {
  id: string;
  provider: { id: string; name: string };
}
export interface ProposalDTO {
  id: string;
  issuerId: string;
  provider: { id: string; name: string };
  properties: object;
  constraints: string;
}

export class AgreementCandidate {
  agreement?: AgreementDTO;
  constructor(readonly proposal: ProposalDTO) {}
}

export interface AgreementServiceOptions extends AgreementOptions {
  strategy?: MarketStrategy;
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
export class AgreementPoolService {
  private logger?: Logger;
  private config: AgreementServiceConfig;

  private pool = new Set<AgreementCandidate>();
  private candidateMap = new Map<string, AgreementCandidate>();
  private agreements = new Map<string, Agreement>();
  private proposals = new Map<string, Proposal>();

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
    this.logger?.debug(`New proposal added to pool from provider (${proposal.provider.name})`);
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
      const candidate = this.candidateMap.get(agreement.id);
      if (candidate) {
        this.pool.add(candidate);
        this.logger?.debug(`Agreement ${agreement.id} has been released for reuse`);
      } else {
        this.logger?.debug(`Agreement ${agreement.id} has been released for but not added to pool for reuse`);
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
    // const toCleanup = Array.from(this.pool).filter((e) => !!e.agreement);
    // console.log("cleanupPool", toCleanup);
  }

  private async getAgreementFormPool(): Promise<Agreement | undefined> {
    this.cleanupPool();

    if (this.pool.size === 0) {
      this.logger?.debug(`Agreement cannot be created due to no available candidates in pool`);
      return;
    }

    // Limit concurrency to 1
    const candidate = await this.limiter.schedule(() => {
      const pool = Array.from(this.pool);
      return this.config.strategy.getBestAgreementCandidate(pool);
    });
    this.pool.delete(candidate);

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
    this.logger?.debug("Agreement Pool Service has been stopped");
  }

  /**
   * Terminate all agreements
   * @param reason
   */
  async terminateAll(reason?: { [key: string]: string }) {
    this.logger?.debug(`Terminate all agreements was called`);
    for (const [agreementId] of Array.from(this.candidateMap)) {
      const agreement = this.agreements.get(agreementId);
      if (agreement && (await agreement.getState()) !== AgreementStateEnum.Terminated)
        await agreement
          .terminate(reason)
          .catch((e) => this.logger?.warn(`Agreement ${agreement.id} cannot be terminated. ${e}`));
    }
  }

  async createAgreement(candidate) {
    try {
      let agreement = await Agreement.create(candidate.proposal.id, this.config.options);
      agreement = await this.waitForAgreementApproval(agreement);
      const state = await agreement.getState();

      if (state !== AgreementStateEnum.Approved) {
        throw new Error(`Agreement ${agreement.id} cannot be approved. Current state: ${state}`);
      }
      this.logger?.info(`Agreement confirmed by provider ${agreement.provider.name}`);

      this.agreements.set(agreement.id, agreement);

      candidate.agreement = {
        id: agreement.id,
        provider: { id: agreement.provider.id, name: agreement.provider.name },
      };

      this.candidateMap.set(agreement.id, candidate);

      return agreement;
    } catch (e) {
      this.logger?.debug(`Unable to create agreement form available proposal: ${e?.data?.message || e}`);
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
