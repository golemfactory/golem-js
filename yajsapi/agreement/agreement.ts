import { Logger } from "../utils";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Agreement as AgreementModel, AgreementStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { YagnaOptions } from "../executor";
import { AgreementFactory } from "./factory";
import { AgreementConfig } from "./config";

export interface ProviderInfo {
  name: string;
  id: string;
}

export { AgreementStateEnum };

export interface AgreementOptions {
  subnetTag?: string;
  yagnaOptions?: YagnaOptions;
  requestTimeout?: number;
  executeTimeout?: number;
  waitingForApprovalTimeout?: number;
  logger?: Logger;
}

export class Agreement {
  private agreementData?: AgreementModel;
  private _provider: ProviderInfo | undefined;

  constructor(
    public readonly id,
    private readonly api: RequestorApi,
    private readonly config: AgreementConfig,
    private logger?: Logger
  ) {}

  static async create(proposalId: string, agreementOptions: AgreementOptions): Promise<Agreement> {
    const factory = new AgreementFactory(agreementOptions);
    return factory.create(proposalId);
  }

  async refreshDetails() {
    const { data } = await this.api.getAgreement(this.id, { timeout: this.config.requestTimeout });
    this.agreementData = data;
    if (!this._provider) {
      this.setupProviderId();
    }
  }

  async getState(): Promise<AgreementStateEnum> {
    await this.refreshDetails();
    return this.agreementData!.state;
  }

  private setupProviderId() {
    const id = this.agreementData?.offer.properties["golem.node.id.name"] ?? null,
      name = this.agreementData?.offer.providerId ?? null;

    if (id === null || name === null) {
      throw new Error("it was not possible to get Provider ID or/and name");
    }

    this._provider = {
      id,
      name,
    };
  }

  get provider() {
    return this._provider;
  }

  async confirm() {
    try {
      await this.api.confirmAgreement(this.id);
      await this.api.waitForApproval(this.id, this.config.waitingForApprovalTimeout);
    } catch (error) {
      this.logger?.error(`Cannot confirm agreement ${this.id}. ${error}`);
      throw error;
    }
  }

  async isFinalState(): Promise<boolean> {
    const state = await this.getState();
    return state !== AgreementStateEnum.Pending && state !== AgreementStateEnum.Proposal;
  }

  async terminate(reason?: { [key: string]: string }) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore TODO: API binding BUG with reason type
      await this.api.terminateAgreement(this.id, reason);
      this.logger?.debug(`Agreement ${this.id} terminated`);
    } catch (error) {
      this.logger?.error(
        `Cannot terminate agreement ${this.id}. ${error.response?.data?.message || error.response?.data || error}`
      );
      throw error;
    }
  }
}
