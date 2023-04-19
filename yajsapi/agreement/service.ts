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
      this.logger?.debug("Proposal has been rejected by market strategy");
      return;
    }
    this.logger?.debug(`New proposal added to pool (${proposal.id})`);
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
      this.logger?.debug(`Agreement ${agreement.id} has been released for reuse`);
      // Agreement to candidate
      //this.pool.add(candidate);
    } else {
      this.logger?.debug(`Agreement ${agreement.id} has been released and removed from pool`);
    }
    // const agreement = await this.agreements.get(agreementId);
    // if (!agreement) {
    //   throw new Error(`Agreement ${agreementId} cannot found in pool`);
    // }
    // if (allowReuse) {
    //   this.agreementIdsToReuse.unshift(agreementId);
    //   this.logger?.debug(`Agreement ${agreementId} has been released for reuse`);
    // } else {
    //   await agreement.terminate();
    //   this.agreements.delete(agreementId);
    //   this.logger?.debug(`Agreement ${agreementId} has been released and terminated`);
    // }
  }

  /**
   * Get agreement ready for use
   * TODO While get() is processing, future get() calls needs to be queued.
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
    // console.log(Array.from(this.pool));
    //     .filter((entry) => {
    //   return entry;
    //   // Wywalamy nieprawidłowe stany
    // });
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

    // console.log("candidate", candidate?.agreement?.getAgreementData);

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
    // for (const agreement of this.agreements.values()) {
    //   if ((await agreement.getState()) !== AgreementStateEnum.Terminated)
    //     await agreement
    //       .terminate(reason)
    //       .catch((e) => this.logger?.warn(`Agreement ${agreement.id} cannot be terminated. ${e}`));
    // }
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
    try {
      console.log("trying with timeout: ", this.config.agreementWaitingForApprovalTimeout);
      await this.config.api.waitForApproval(agreement.id, this.config.agreementWaitingForApprovalTimeout);
    } catch (e) {
      console.error("waitForAgreementApproval", e);
    }
    return agreement;
  }

  /*
    private async getAvailableAgreement(): Promise<Agreement | undefined> {
      let readyAgreement;
      while (!readyAgreement && this.agreementIdsToReuse.length > 0) {
        const availableAgreementId = this.agreementIdsToReuse.pop();
        if (!availableAgreementId) continue;
        const availableAgreement = this.agreements.get(availableAgreementId);
        if (!availableAgreement) throw new Error(`Agreement ${availableAgreementId} cannot found in pool`);

        const state = await availableAgreement.getState().catch((e) => {
          this.logger?.warn(`Unable to retrieve state of agreement ${availableAgreement.id}. ` + e);
        });

        if (state !== AgreementStateEnum.Approved) {
          this.logger?.debug(`Agreement ${availableAgreement.id} is no longer available. Current state: ${state}`);
          continue;
        }

        readyAgreement = availableAgreement;
      }
      return readyAgreement;
    }

    private async createAgreement(): Promise<Agreement | undefined> {
      let agreement;
      while (!agreement && this.isServiceRunning) {
        const proposalId = await this.getAvailableProposal();
        if (!proposalId) break;
        this.logger?.debug(`Creating agreement using proposal ID: ${proposalId}`);
        try {
          agreement = await Agreement.create(proposalId, this.config.options);
          agreement = await this.waitForAgreementApproval(agreement);
          const state = await agreement.getState();
          if ((agreement.provider.id, state === AgreementStateEnum.Rejected)) {
            await this.config.marketStrategy.setAgreementRejectedByProvider(agreement);
          }

          if (state !== AgreementStateEnum.Approved) {
            throw new Error(`Agreement ${agreement.id} cannot be approved. Current state: ${state}`);
          }
        } catch (e) {
          this.logger?.error(`Unable to create agreement form available proposal: ${e?.data?.message || e}`);
          await sleep(2);
          agreement = null;
        }
      }
      if (agreement) {
        this.agreements.set(agreement.id, agreement);
        this.logger?.info(`Agreement confirmed by provider ${agreement.provider.name}`);
      } else {
        this.isServiceRunning && this.logger?.debug(`Agreement cannot be created due to no available offers from market`);
      }
      return agreement;
    }

    private async getAvailableProposal(): Promise<string | undefined> {
      let proposal;
      let timeout = false;
      const timeoutId = setTimeout(() => (timeout = true), this.config.agreementWaitingForProposalTimout);
      while (!proposal && this.isServiceRunning && !timeout) {
        proposal = this.proposals.pop();
        if (!proposal) {
          if (+new Date() > this.initialTime + 9000) this.logger?.warn(`No offers have been collected from the market`);
          await sleep(10);
        }
      }
      clearTimeout(timeoutId);
      this.initialTime = +new Date();
      return proposal;
    }
    private async waitForAgreementApproval(agreement: Agreement) {
      const state = await agreement.getState();

      if (state === AgreementStateEnum.Proposal) {
        await agreement.confirm();
        this.logger?.debug(`Agreement proposed to provider '${agreement.provider.name}'`);
      }

      /* Solution for support events in the future
       * let timeout = false;
       * const timeoutId = setTimeout(() => (timeout = true), this.config.waitingForApprovalTimeout);
       * while ((await agreement.isFinalState()) && !timeout) {
       *   await sleep(2);
       * }
       * clearTimeout(timeoutId);
       **/

  /*/ Will throw an exception if the agreement will be not approved in specific timeout
    await this.config.api.waitForApproval(agreement.id, this.config.agreementWaitingForApprovalTimeout);

    return agreement;
  }
*/
}
