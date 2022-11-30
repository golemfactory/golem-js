import { Logger } from "../utils";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Agreement as AgreementModel, AgreementStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { AgreementConfigContainer } from "./agreement_config_container";
import { YagnaOptions } from "../executor";

export { AgreementStateEnum };

export interface AgreementOptions {
  yagnaOptions?: YagnaOptions;
  requestTimeout?: number;
  executeTimeout?: number;
  eventPoolingInterval?: number;
  eventPoolingMaxEventsPerRequest?: number;
  logger?: Logger;
}

export interface ProviderInfo {
  providerName: string;
  providerId: string;
}

export class Agreement {
  private readonly api: RequestorApi;
  private readonly logger?: Logger;
  private readonly requestTimeout: number;

  private agreementData?: AgreementModel;

  constructor(public readonly id, private readonly configContainer: AgreementConfigContainer) {
    this.logger = configContainer.logger;
    this.api = configContainer.api;
    this.requestTimeout = configContainer.options?.requestTimeout || 10000;
    // this.refreshDetails()
    //   .then((x) => {
    //     this._providerId = x.id;
    //   })
    //   .catch((e) => {});
  }
  //
  // get providerId() {
  //   return this._providerId;
  // }

  async refreshDetails() {
    const { data } = await this.api.getAgreement(this.id, { timeout: this.requestTimeout });
    this.agreementData = data;
  }

  getProviderInfo(): ProviderInfo {
    return {
      providerName: this.agreementData!.offer.properties["golem.node.id.name"],
      providerId: this.agreementData!.offer.providerId,
    };
  }

  async getState(): Promise<AgreementStateEnum> {
    await this.refreshDetails();
    return this.agreementData!.state;
  }

  async isFinalState(): Promise<boolean> {
    const state = await this.getState();
    return state !== AgreementStateEnum.Pending && state !== AgreementStateEnum.Proposal;
  }

  getAgreementData(): AgreementModel | undefined {
    return this.agreementData;
  }

  async confirm() {
    try {
      await this.api.confirmAgreement(this.id);
      await this.api.waitForApproval(this.id, 15);
    } catch (error) {
      this.logger?.error(`Cannot confirm agreement ${this.id}. ${error}`);
      throw error;
    }
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
