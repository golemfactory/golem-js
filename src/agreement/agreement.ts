import { Logger, YagnaOptions } from "../shared/utils";
import { MarketApi } from "ya-ts-client";
import { OfferProposal } from "../market";
import { AgreementDTO } from "./service";
import { InvoiceFilter } from "../payment/service";

export interface ProviderInfo {
  name: string;
  id: string;
  walletAddress: string;
}

/**
 * @hidden
 * @deprecated
 */
export interface LegacyAgreementServiceOptions {
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

export interface IAgreementRepository {
  getById(id: string): Promise<Agreement>;
}

export interface IAgreementApi {
  getAgreement(id: string): Promise<Agreement>;

  /**
   * Request creating an agreement from the provided proposal
   *
   * Use this method if you want to decide what should happen with the agreement after it is created
   *
   * @return An agreement that's in a "Proposal" state (not yet usable for activity creation)
   */
  createAgreement(proposal: OfferProposal): Promise<Agreement>;

  /**
   * Request creating an agreement from the provided proposal, send it to the Provider and wait for approval
   *
   * Use this method when you want to quickly finalize the deal with the Provider, but be ready for a rejection
   *
   * @return An agreement that's already in an "Approved" state and can be used to create activities on the Provider
   */
  proposeAgreement(proposal: OfferProposal): Promise<Agreement>;

  // TODO: Detach return type from ya-ts-client!
  getAgreementState(id: string): Promise<MarketApi.AgreementDTO["state"]>;

  confirmAgreement(agreement: Agreement): Promise<Agreement>;

  terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement>;
}

/**
 * Agreement module - an object representing the contract between the requestor and the provider.
 */
export class Agreement {
  /**
   * @param id
   * @param model
   * @param paymentPlatform
   */
  constructor(
    public readonly id: string,
    private model: MarketApi.AgreementDTO,
    private readonly paymentPlatform: string,
  ) {}

  /**
   * Return agreement state
   * @return state
   */
  getState() {
    return this.model.state;
  }

  getProviderInfo(): ProviderInfo {
    return {
      id: this.model.offer.providerId,
      name: this.model.offer.properties["golem.node.id.name"],
      walletAddress: this.model.offer.properties[`golem.com.payment.platform.${this.paymentPlatform}.address`],
    };
  }

  getDto(): AgreementDTO {
    return {
      id: this.id,
      provider: this.getProviderInfo(),
    };
  }

  public update(model: MarketApi.AgreementDTO) {
    this.model = model;
  }

  /**
   * Returns flag if the agreement is in the final state
   * @description if the final state is true, agreement will not change state further anymore
   * @return boolean
   */
  async isFinalState(): Promise<boolean> {
    const state = this.getState();
    return state !== "Pending" && state !== "Proposal";
  }
}
