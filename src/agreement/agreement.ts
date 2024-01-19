import { Logger, YagnaApi, defaultLogger } from "../utils";
import { Agreement as AgreementModel } from "ya-ts-client/dist/ya-market/src/models";
import { YagnaOptions } from "../executor";
import { AgreementFactory } from "./factory";
import { AgreementConfig } from "./config";
import { Events } from "../events";
import { GolemMarketError, MarketErrorCode } from "../market/error";
import { Proposal } from "../market";

export interface ProviderInfo {
  name: string;
  id: string;
  walletAddress: string;
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
  private logger: Logger;

  /**
   * @param id - agreement ID
   * @param proposal - {@link Proposal}
   * @param yagnaApi - {@link YagnaApi}
   * @param options - {@link AgreementConfig}
   * @hidden
   */
  constructor(
    public readonly id: string,
    public readonly proposal: Proposal,
    private readonly yagnaApi: YagnaApi,
    private readonly options: AgreementConfig,
  ) {
    this.logger = options.logger || defaultLogger("market");
  }

  /**
   * Create agreement for given proposal
   * @param proposal
   * @param yagnaApi
   * @param agreementOptions - {@link AgreementOptions}
   * @return Agreement
   */
  static async create(proposal: Proposal, yagnaApi: YagnaApi, agreementOptions?: AgreementOptions): Promise<Agreement> {
    const factory = new AgreementFactory(yagnaApi, agreementOptions);
    return factory.create(proposal);
  }

  /**
   * Refresh agreement details
   */
  async refreshDetails() {
    const { data } = await this.yagnaApi.market.getAgreement(this.id, {
      timeout: this.options.agreementRequestTimeout,
    });
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

  get provider(): ProviderInfo {
    return this.proposal.provider;
  }

  /**
   * Confirm agreement and waits for provider approval
   * @description Blocking function waits till agreement will be confirmed and approved by provider
   *
   * @param appSessionId - Optional correlation/session identifier used for querying events
   * related to this agreement
   */
  async confirm(appSessionId?: string) {
    try {
      await this.yagnaApi.market.confirmAgreement(this.id, appSessionId);
      await this.yagnaApi.market.waitForApproval(this.id, this.options.agreementWaitingForApprovalTimeout);
      this.logger.debug(`Agreement approved`, { id: this.id });
      this.options.eventTarget?.dispatchEvent(new Events.AgreementConfirmed({ id: this.id, provider: this.provider }));
    } catch (error) {
      this.logger.error(`Unable to confirm agreement with provider`, { providerName: this.provider.name, error });
      this.options.eventTarget?.dispatchEvent(
        new Events.AgreementRejected({ id: this.id, provider: this.provider, reason: error.toString() }),
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
        await this.yagnaApi.market.terminateAgreement(this.id, reason, {
          timeout: this.options.agreementRequestTimeout,
        });
      this.options.eventTarget?.dispatchEvent(
        new Events.AgreementTerminated({ id: this.id, provider: this.provider, reason: reason.message }),
      );
      this.logger.debug(`Agreement terminated`, { id: this.id });
    } catch (error) {
      throw new GolemMarketError(
        `Unable to terminate agreement ${this.id}. ${error.response?.data?.message || error.response?.data || error}`,
        MarketErrorCode.AgreementTerminationFailed,
        this.proposal.demand,
      );
    }
  }
}
