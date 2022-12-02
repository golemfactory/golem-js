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
  private logger?: Logger;

  constructor(public readonly id, public readonly provider: ProviderInfo, private readonly config: AgreementConfig) {
    this.logger = config.logger;
  }

  static async create(proposalId: string, agreementOptions?: AgreementOptions): Promise<Agreement> {
    const factory = new AgreementFactory(agreementOptions);
    return factory.create(proposalId);
  }

  async refreshDetails() {
    const { data } = await this.config.api.getAgreement(this.id, { timeout: this.config.requestTimeout });
    this.agreementData = data;
  }

  async getState(): Promise<AgreementStateEnum> {
    await this.refreshDetails();
    return this.agreementData!.state;
  }

  async confirm() {
    try {
      await this.config.api.confirmAgreement(this.id);
      await this.config.api.waitForApproval(this.id, this.config.waitingForApprovalTimeout);
      this.logger?.debug(`Agreement ${this.id} approved`);
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
      await this.config.api.terminateAgreement(this.id, reason);
      this.logger?.debug(`Agreement ${this.id} terminated`);
    } catch (error) {
      throw new Error(
        `Unable to terminate agreement ${this.id}. ${error.response?.data?.message || error.response?.data || error}`
      );
    }
  }
}
