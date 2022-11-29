import { Logger } from "../utils";
import { Agreement, AgreementOptions, AgreementStateEnum } from "./agreement";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import sleep from "../utils/sleep";

import { AgreementFactory } from "./factory";
import { ComputationHistory } from "../market/strategy";
import { Configuration } from "ya-ts-client/dist/ya-market";

export interface AgreementServiceOptions extends AgreementOptions {
  eventPoolingInterval?: number;
  eventPoolingMaxEventsPerRequest?: number;
}

export interface AgreementProposal {
  proposalId: string;
}

// TODO: This is now in rest/market - think about a better place
export type TerminationReason = { message: string; "golem.requestor.code"?: string };

export class AgreementPoolService implements ComputationHistory {
  private logger?: Logger;
  private api: RequestorApi;
  private eventPoolingInterval: number;
  private eventPoolingMaxEventsPerRequest: number;

  private proposals: string[] = [];
  private agreements = new Map<string, Agreement>();
  private agreementIdsToReuse: string[] = [];
  private isServiceRunning = false;
  private lastAgreementRejectedByProvider = new Map<string, boolean>();
  private initialTime = 0;

  constructor(private readonly agreementServiceOptions: AgreementServiceOptions) {
    this.logger = agreementServiceOptions.logger;
    this.api = new RequestorApi(
        new Configuration({
          apiKey: agreementServiceOptions.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY,
          basePath: (agreementServiceOptions.yagnaOptions?.basePath || process.env.YAGNA_URL) + "/market-api/v1",
          accessToken: agreementServiceOptions.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY,
        })
    );
    this.eventPoolingInterval = agreementServiceOptions?.eventPoolingInterval || 10000;
    this.eventPoolingMaxEventsPerRequest = agreementServiceOptions?.eventPoolingMaxEventsPerRequest || 10;
  }

  async run() {
    this.isServiceRunning = true;
    this.initialTime = +new Date();
    this.logger?.debug("Agreement Pool Service has started");
  }

  addProposal(proposalId: string) {
    this.logger?.debug(`New offer proposal added to pool (${proposalId})`);
    this.proposals.push(proposalId);
  }

  async getAgreement(): Promise<Agreement> {
    return (await this.getAvailableAgreement()) || (await this.createAgreement());
  }

  async releaseAgreement(agreementId: string, allowReuse = false) {
    const agreement = await this.agreements.get(agreementId);
    if (!agreement) throw new Error(`Agreement ${agreementId} cannot found in pool`);
    if (allowReuse) this.agreementIdsToReuse.unshift(agreementId);
    else {
      await agreement.terminate();
      this.agreements.delete(agreementId);
    }
    this.logger?.debug(`Agreement ${agreementId} has been released ${allowReuse ? "for reuse" : ""}`);
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
        this.logger?.warn(`Cannot retrieve state of agreement ${availableAgreement.id}. ` + e);
      });

      if (state !== AgreementStateEnum.Approved) {
        this.logger?.debug(`Agreement ${availableAgreement.id} is no longer available. Current state: ${state}`);
        continue;
      }

      readyAgreement = availableAgreement;
    }
    return readyAgreement;
  }

  private async createAgreement(): Promise<Agreement> {
    let agreement;
    while (!agreement && this.isServiceRunning) {
      const proposalId = await this.getAvailableProposal();
      if (!proposalId) break;

      this.logger?.debug(`Creating agreement using proposal ID: ${proposalId}`);
      try {
        const agreementFactory = new AgreementFactory(this.agreementServiceOptions);
        agreement = await agreementFactory.create(proposalId);
        agreement = await this.waitForAgreementApproval(agreement);

        const state = await agreement.getState();
        this.lastAgreementRejectedByProvider.set(agreement.providerId, state === AgreementStateEnum.Rejected);

        if (state !== AgreementStateEnum.Approved) {
          throw new Error(`Agreement ${agreement.id} cannot be approved. Current state: ${state}`);
        }
      } catch (e) {
        this.logger?.error(`Could not create agreement form available proposal: ${e.message}`);
        // TODO: What we should do with used proposal in that case ?? unshift to begin ?
        await sleep(2);

        // If id to go kill'em
        agreement = null;
      }
    }
    this.agreements.set(agreement.id, agreement);
    this.logger?.debug(`Agreement ${agreement.id} created with provider ${agreement.getProviderInfo().providerName}`);
    return agreement;
  }

  private async getAvailableProposal(): Promise<string> {
    let proposal;
    while (!proposal && this.isServiceRunning) {
      proposal = this.proposals.pop();
      if (!proposal) {
        if (+new Date() > this.initialTime + 10000) this.logger?.warn(`No offers have been collected from the market`);
        await sleep(10);
      }
    }
    return proposal;
  }

  private async waitForAgreementApproval(agreement: Agreement) {
    const state = await agreement.getState();

    if (state === AgreementStateEnum.Proposal) {
      await agreement.confirm();
      this.logger?.debug(`Agreement ${agreement.id} confirmed`);
    }

    let timeout = false;
    const timeoutId = setTimeout(() => (timeout = true), 10000);
    while ((await agreement.isFinalState()) && !timeout) {
      await sleep(2);
    }
    clearTimeout(timeoutId);
    return agreement;
  }
}
