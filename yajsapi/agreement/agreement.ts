import { Logger } from "../utils";
import { Agreement as AgreementModel, AgreementStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { YagnaOptions } from "../executor";
import { AgreementFactory } from "./factory";
import { AgreementConfig } from "./config";
import { Events } from "../events";

export interface ProviderInfo {
  name: string;
  id: string;
}

export { AgreementStateEnum };

export interface AgreementOptions {
  /** subnet tag */
  subnetTag?: string; // TODO check if it is used? maybe in service?
  /** yagnaOptions */
  yagnaOptions?: YagnaOptions; // TODO check if it is used? maybe in service?
  /** timeout for create agreement and refresh details in ms */
  requestTimeout?: number;
  executeTimeout?: number; // TODO check if it is used? maybe in service?
  /** timeout for wait for provider approval after requestor confirmation in ms */
  waitingForApprovalTimeout?: number;
  /** Logger module */
  logger?: Logger;
  /** Event Bus implements EventTarget  */
  eventTarget?: EventTarget;
}

export class Agreement {
  private agreementData?: AgreementModel;
  private logger?: Logger;

  constructor(public readonly id, public readonly provider: ProviderInfo, private readonly options: AgreementConfig) {
    this.logger = options.logger;
  }

  /**
   * Create agreement for given proposal ID
   * @param proposalId
   * @param options - {@link AgreementOptions}
   * @return Agreement
   */
  static async create(proposalId: string, agreementOptions?: AgreementOptions): Promise<Agreement> {
    const factory = new AgreementFactory(agreementOptions);
    return factory.create(proposalId);
  }

  /**
   * Refresh agreement details
   */
  async refreshDetails() {
    const { data } = await this.options.api.getAgreement(this.id, { timeout: this.options.requestTimeout });
    this.agreementData = data;
  }

  /**
   * Return agreement state
   * @return state
   */
  async getState(): Promise<AgreementStateEnum> {
    await this.refreshDetails();
    return this.agreementData!.state;
  }

  /**
   * Confirm agreement and waits for provider approval
   * @description Blocking function waits till agreement will be confirmed and approved by provider
   * @throws Error if the agreement will be rejected by provider or failed to confirm
   */
  async confirm() {
    try {
      await this.options.api.confirmAgreement(this.id);
      await this.options.api.waitForApproval(this.id, this.options.waitingForApprovalTimeout);
      this.logger?.debug(`Agreement ${this.id} approved`);
      this.options.eventTarget?.dispatchEvent(
        new Events.AgreementConfirmed({ id: this.id, providerId: this.provider.id })
      );
    } catch (error) {
      this.logger?.error(`Unable to confirm agreement ${this.id}. ${error}`);
      throw error;
    }
  }

  /**
   * Returns flag if the agreement is in the final state
   * @description if the final state is true, agreement will not change state further anymore
   * @return boolean
   */
  async isFinalState(): Promise<boolean> {
    const state = await this.getState();
    return state !== AgreementStateEnum.Pending && state !== AgreementStateEnum.Proposal;
  }

  /**
   * Terminate agreement
   * @description Blocking function waits till agreement will be terminated
   * @throws Error if the agreement will be unable to terminate
   */
  async terminate(reason: { [key: string]: string } = { message: "Finished" }) {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore TODO: API binding BUG with reason type
      await this.options.api.terminateAgreement(this.id, reason);
      this.options.eventTarget?.dispatchEvent(
        new Events.AgreementTerminated({ id: this.id, providerId: this.provider.id })
      );
      this.logger?.debug(`Agreement ${this.id} terminated`);
    } catch (error) {
      throw new Error(
        `Unable to terminate agreement ${this.id}. ${error.response?.data?.message || error.response?.data || error}`
      );
    }
  }
}
