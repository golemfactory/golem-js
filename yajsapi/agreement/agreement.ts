import { Logger } from "../utils";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Agreement as AgreementModel, AgreementStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { YagnaOptions } from "../executor";
import { AgreementFactory } from "./factory";

export { AgreementStateEnum };

export interface AgreementOptions {
  subnetTag?: string;
  yagnaOptions?: YagnaOptions;
  requestTimeout?: number;
  executeTimeout?: number;
  eventPoolingInterval?: number;
  eventPoolingMaxEventsPerRequest?: number;
  logger?: Logger;
}

export class Agreement {
  private agreementData?: AgreementModel;
  private requestTimeout = 10000; // @TODO

  constructor(
    public readonly id,
    public readonly provider: { id: string; name: string },
    private readonly api: RequestorApi,
    private logger?: Logger
  ) { }


  static async create(proposalId: string, agreementOptions: AgreementOptions): Promise<Agreement> {
    const factory = new AgreementFactory(agreementOptions);
    return factory.create(proposalId)
  }

  async refreshDetails() {
    const { data } = await this.api.getAgreement(this.id, { timeout: this.requestTimeout });
    this.agreementData = data;
  }

  async getState(): Promise<AgreementStateEnum> {
    await this.refreshDetails();
    return this.agreementData!.state;
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
