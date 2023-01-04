import { Logger } from "../utils";
import { Agreement, AgreementOptions, AgreementStateEnum } from "./agreement";
import sleep from "../utils/sleep";

import { ComputationHistory } from "../market/strategy";
import { AgreementServiceConfig } from "./config";

export interface AgreementServiceOptions extends AgreementOptions {
  eventPoolingInterval?: number;
  eventPoolingMaxEventsPerRequest?: number;
  waitingForProposalTimout?: number;
}

export interface AgreementProposal {
  proposalId: string;
}

// TODO: This is now in rest/market - think about a better place
export type TerminationReason = { message: string; "golem.requestor.code"?: string };

export class AgreementPoolService implements ComputationHistory {
  private logger?: Logger;
  private config: AgreementServiceConfig;

  private proposals: string[] = [];
  private agreements = new Map<string, Agreement>();
  private agreementIdsToReuse: string[] = [];
  private isServiceRunning = false;
  private lastAgreementRejectedByProvider = new Map<string, boolean>();
  private initialTime = Date.now();

  constructor(private readonly agreementServiceOptions?: AgreementServiceOptions) {
    this.config = new AgreementServiceConfig(agreementServiceOptions);
    this.logger = agreementServiceOptions?.logger;
  }

  async run() {
    this.isServiceRunning = true;
    this.initialTime = +new Date();
    this.logger?.debug("Agreement Pool Service has started");
  }

  addProposal(proposalId: string) {
    this.proposals.push(proposalId);
    this.logger?.debug(`New offer proposal added to pool (${proposalId})`);
  }

  async getAgreement(): Promise<Agreement> {
    let agreement;
    while (!agreement && this.isServiceRunning)
      agreement = (await this.getAvailableAgreement()) || (await this.createAgreement());
    return agreement;
  }

  async releaseAgreement(agreementId: string, allowReuse = false) {
    const agreement = await this.agreements.get(agreementId);
    if (!agreement) {
      throw new Error(`Agreement ${agreementId} cannot found in pool`);
    }
    if (allowReuse) {
      this.agreementIdsToReuse.unshift(agreementId);
      this.logger?.debug(`Agreement ${agreementId} has been released for reuse`);
    } else {
      await agreement.terminate();
      this.agreements.delete(agreementId);
      this.logger?.debug(`Agreement ${agreementId} has been released and terminated`);
    }
  }

  async end() {
    this.isServiceRunning = false;
    await this.terminateAll({ message: "All computations done" });
    this.logger?.debug("Agreement Pool Service has been stopped");
  }

  isProviderLastAgreementRejected(providerId: string): boolean {
    return !!this.lastAgreementRejectedByProvider.get(providerId);
  }

  async terminateAll(reason?: { [key: string]: string }) {
    for (const agreement of this.agreements.values()) {
      await agreement
        .terminate(reason)
        .catch((e) => this.logger?.warn(`Agreement ${agreement.id} cannot be terminated. ${e}`));
    }
  }

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
        this.lastAgreementRejectedByProvider.set(agreement.provider.id, state === AgreementStateEnum.Rejected);

        if (state !== AgreementStateEnum.Approved) {
          throw new Error(`Agreement ${agreement.id} cannot be approved. Current state: ${state}`);
        }
      } catch (e) {
        this.logger?.error(`Unable to create agreement form available proposal: ${e?.data?.message || e}`);
        // TODO: What we should do with used proposal in that case ?? unshift to begin ?
        await sleep(2);
        // If id to go kill'em
        agreement = null;
      }
    }
    if (agreement) {
      this.agreements.set(agreement.id, agreement);
      this.logger?.debug(`Agreement ${agreement.id} signed with provider ${agreement.provider.name}`);
    } else {
      this.logger?.debug(`Agreement cannot be created due to no available offers from market`);
    }
    return agreement;
  }

  private async getAvailableProposal(): Promise<string | undefined> {
    let proposal;
    let timeout = false;
    const timeoutId = setTimeout(() => (timeout = true), this.config.waitingForProposalTimout);
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
      this.logger?.debug(`Agreement ${agreement.id} confirmed`);
    }

    /** Solution for support events in the future
     * let timeout = false;
     * const timeoutId = setTimeout(() => (timeout = true), this.config.waitingForApprovalTimeout);
     * while ((await agreement.isFinalState()) && !timeout) {
     *   await sleep(2);
     * }
     * clearTimeout(timeoutId);
     **/

    // Will throw an exception if the agreement will be not approved in specific timeout
    await this.config.api.waitForApproval(agreement.id, this.config.waitingForApprovalTimeout);

    return agreement;
  }
}
