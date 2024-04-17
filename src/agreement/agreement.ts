import { defaultLogger, Logger, YagnaApi, YagnaOptions } from "../shared/utils";
import { MarketApi } from "ya-ts-client";
import { AgreementFactory } from "./factory";
import { AgreementConfig } from "./config";
import { GolemMarketError, MarketErrorCode, Proposal } from "../market";
import { withTimeout } from "../shared/utils/timeout";
import { EventEmitter } from "eventemitter3";
import { AgreementDTO } from "./service";
import { InvoiceFilter } from "../payment/service";

export interface AgreementEvents {
  confirmed: (details: { id: string; provider: ProviderInfo }) => void;
  rejected: (details: { id: string; provider: ProviderInfo; reason: string }) => void;
  terminated: (details: { id: string; provider: ProviderInfo; reason: string }) => void;
}
export interface ProviderInfo {
  name: string;
  id: string;
  walletAddress: string;
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

  invoiceFilter?: InvoiceFilter;
}
/**
 * Agreement module - an object representing the contract between the requestor and the provider.
 * @hidden
 */
export class Agreement {
  private agreementData?: MarketApi.AgreementDTO;
  private logger: Logger;
  public readonly events = new EventEmitter<AgreementEvents>();

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
    this.agreementData = await withTimeout(
      this.yagnaApi.market.getAgreement(this.id),
      this.options.agreementRequestTimeout,
    );
  }

  /**
   * Return agreement state
   * @return state
   */
  async getState(): Promise<MarketApi.AgreementDTO["state"]> {
    await this.refreshDetails();
    return this.agreementData!.state;
  }

  getProviderInfo(): ProviderInfo {
    return this.proposal.provider;
  }

  getDto(): AgreementDTO {
    return {
      id: this.id,
      provider: this.getProviderInfo(),
    };
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
      this.events.emit("confirmed", { id: this.id, provider: this.getProviderInfo() });
    } catch (error) {
      this.logger.error(`Unable to confirm agreement with provider`, {
        providerName: this.getProviderInfo().name,
        error,
      });
      this.events.emit("rejected", {
        id: this.id,
        provider: this.getProviderInfo(),
        reason: error.toString(),
      });
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
    return state !== "Pending" && state !== "Proposal";
  }

  /**
   * Terminate agreement
   * @description Blocking function waits till agreement will be terminated
   * @throws Error if the agreement will be unable to terminate
   */
  async terminate(reason: { [key: string]: string } = { message: "Finished" }) {
    try {
      if ((await this.getState()) !== "Terminated")
        await withTimeout(
          this.yagnaApi.market.terminateAgreement(this.id, reason),
          this.options.agreementRequestTimeout,
        );
      this.events.emit("terminated", {
        id: this.id,
        provider: this.getProviderInfo(),
        reason: reason.message,
      });
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
