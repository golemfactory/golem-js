import { Logger } from "../utils/index.js";
import { Agreement as AgreementModel } from "ya-ts-client/dist/ya-market/src/models/index.js";
import { YagnaOptions } from "../executor/index.js";
import { AgreementFactory } from "./factory.js";
import { AgreementConfig } from "./config.js";
import { Events } from "../events/index.js";

/**
 * @hidden
 */
export interface ProviderInfo {
  name: string;
  id: string;
}

/**
 * @hidden
 */
export enum AgreementStateEnum {
  Proposal = "Proposal",
  Pending = "Pending",
  Cancelled = "Cancelled",
  Rejected = "Rejected",
  Approved = "Approved",
  Expired = "Expired",
  Terminated = "Terminated",
}

/**
 * @hidden
 */
export interface AgreementOptions {
  /** yagnaOptions */
  yagnaOptions?: YagnaOptions;
  /** timeout for create agreement and refresh details in ms */
  agreementRequestTimeout?: number;
  /** timeout for wait for provider approval after requestor confirmation in ms */
  agreementWaitingForApprovalTimeout?: number;
  /** Logger module */
  logger?: Logger;
  /** Event Bus implements EventTarget  */
  eventTarget?: EventTarget;
}
/**
 * Agreement module - an object representing the contract between the requestor and the provider.
 * @hidden
 */
export class Agreement {
  private agreementData?: AgreementModel;
  private logger?: Logger;

  /**
   * @param id - agreement ID
   * @param provider - {@link ProviderInfo}
   * @param options - {@link AgreementConfig}
   * @hidden
   */
  constructor(
    public readonly id,
    public readonly provider: ProviderInfo,
    private readonly options: AgreementConfig,
  ) {
    this.logger = options.logger;
  }

  /**
   * Create agreement for given proposal ID
   * @param proposalId - proposal ID
   * @param agreementOptions - {@link AgreementOptions}
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
    const { data } = await this.options.api.getAgreement(this.id, { timeout: this.options.agreementRequestTimeout });
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
      await this.options.api.waitForApproval(this.id, this.options.agreementWaitingForApprovalTimeout);
      this.logger?.debug(`Agreement ${this.id} approved`);
      this.options.eventTarget?.dispatchEvent(
        new Events.AgreementConfirmed({ id: this.id, providerId: this.provider.id }),
      );
    } catch (error) {
      this.logger?.debug(`Unable to confirm agreement with provider ${this.provider.name}. ${error}`);
      this.options.eventTarget?.dispatchEvent(
        new Events.AgreementRejected({ id: this.id, providerId: this.provider.id, reason: error.toString() }),
      );
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
      if ((await this.getState()) !== AgreementStateEnum.Terminated)
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore TODO: API binding BUG with reason type
        await this.options.api.terminateAgreement(this.id, reason, {
          timeout: this.options.agreementRequestTimeout,
        });
      this.options.eventTarget?.dispatchEvent(
        new Events.AgreementTerminated({ id: this.id, providerId: this.provider.id }),
      );
      this.logger?.debug(`Agreement ${this.id} terminated`);
    } catch (error) {
      throw new Error(
        `Unable to terminate agreement ${this.id}. ${error.response?.data?.message || error.response?.data || error}`,
      );
    } finally {
      this.options.httpAgent.destroy?.();
    }
  }
}
