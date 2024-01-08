import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market";
import { Events } from "../events";
import { GolemError } from "../error/golem-error";
import { ProviderInfo } from "../agreement";

export type PricingInfo = {
  cpuSec: number;
  envSec: number;
  start: number;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export type ProposalProperties = Record<string, string | number | string[] | number[] | boolean> & {
  "golem.activity.caps.transfer.protocol": string[];
  "golem.com.payment.debit-notes.accept-timeout?": number;
  "golem.com.payment.platform.erc20-polygon-glm.address"?: string;
  "golem.com.payment.platform.erc20-goerli-tglm.address"?: string;
  "golem.com.payment.platform.erc20-mumbai-tglm.address"?: string;
  /**
   * @deprecated rinkeby is no longer supported, use other test networks instead
   */
  "golem.com.payment.platform.erc20-rinkeby-tglm.address"?: string;
  /**
   * @deprecated rinkeby is no longer supported, use other test networks instead
   */
  "golem.com.payment.platform.zksync-rinkeby-tglm.address"?: string;
  "golem.com.pricing.model": "linear";
  "golem.com.pricing.model.linear.coeffs": number[];
  "golem.com.scheme": string;
  "golem.com.scheme.payu.debit-note.interval-sec?"?: number;
  "golem.com.scheme.payu.payment-timeout-sec?"?: number;
  "golem.com.usage.vector": string[];
  "golem.inf.cpu.architecture": string;
  "golem.inf.cpu.brand": string;
  "golem.inf.cpu.capabilities": string[];
  "golem.inf.cpu.cores": number;
  "golem.inf.cpu.model": string;
  "golem.inf.cpu.threads": number;
  "golem.inf.cpu.vendor": string[];
  "golem.inf.mem.gib": number;
  "golem.inf.storage.gib": number;
  "golem.node.debug.subnet": string;
  "golem.node.id.name": string;
  "golem.node.net.is-public": boolean;
  "golem.runtime.capabilities": string[];
  "golem.runtime.name": string;
  "golem.runtime.version": string;
  "golem.srv.caps.multi-activity": boolean;
  "golem.srv.caps.payload-manifest": boolean;
};

export interface ProposalDetails {
  transferProtocol: string[];
  cpuBrand: string;
  cpuCapabilities: string[];
  cpuCores: number;
  cpuThreads: number;
  memory: number;
  storage: number;
  publicNet: boolean;
  runtimeCapabilities: string[];
  runtimeName: string;
  state: ProposalAllOfStateEnum;
}

/**
 * Proposal module - an object representing an offer in the state of a proposal from the provider.
 */
export class Proposal {
  id: string;
  readonly issuerId: string;
  readonly provider: ProviderInfo;
  readonly properties: ProposalProperties;
  readonly constraints: string;
  readonly timestamp: string;
  counteringProposalId: string | null;
  private readonly state: ProposalAllOfStateEnum;
  private readonly prevProposalId: string | undefined;

  /**
   * Create proposal for given subscription ID
   *
   * @param subscriptionId - subscription ID
   * @param parentId - Previous proposal ID with Initial state
   * @param setCounteringProposalReference
   * @param api - {@link RequestorApi}
   * @param model - {@link ProposalModel}
   * @param demandRequest - {@link DemandOfferBase}
   * @param paymentPlatform
   * @param eventTarget - {@link EventTarget}
   */
  constructor(
    private readonly subscriptionId: string,
    private readonly parentId: string | null,
    private readonly setCounteringProposalReference: (id: string, parentId: string) => void | null,
    private readonly api: RequestorApi,
    model: ProposalModel,
    private readonly demandRequest: DemandOfferBase,
    private readonly paymentPlatform: string,
    private eventTarget?: EventTarget,
  ) {
    this.id = model.proposalId;
    this.issuerId = model.issuerId;
    this.properties = model.properties as ProposalProperties;
    this.constraints = model.constraints;
    this.state = model.state;
    this.prevProposalId = model.prevProposalId;
    this.timestamp = model.timestamp;
    this.counteringProposalId = null;
    this.provider = this.getProviderInfo();

    // Run validation to ensure that the Proposal is in a complete and correct state
    this.validate();
  }

  get details(): ProposalDetails {
    return {
      transferProtocol: this.properties["golem.activity.caps.transfer.protocol"],
      cpuBrand: this.properties["golem.inf.cpu.brand"],
      cpuCapabilities: this.properties["golem.inf.cpu.capabilities"],
      cpuCores: this.properties["golem.inf.cpu.cores"],
      cpuThreads: this.properties["golem.inf.cpu.threads"],
      memory: this.properties["golem.inf.mem.gib"],
      storage: this.properties["golem.inf.storage.gib"],
      publicNet: this.properties["golem.node.net.is-public"],
      runtimeCapabilities: this.properties["golem.runtime.capabilities"],
      runtimeName: this.properties["golem.runtime.name"],
      state: this.state,
    };
  }

  get pricing(): PricingInfo {
    const usageVector = this.properties["golem.com.usage.vector"];
    const priceVector = this.properties["golem.com.pricing.model.linear.coeffs"];

    const envIdx = usageVector.findIndex((ele) => ele === "golem.usage.duration_sec");
    const cpuIdx = usageVector.findIndex((ele) => ele === "golem.usage.cpu_sec");

    const envSec = priceVector[envIdx] ?? 0.0;
    const cpuSec = priceVector[cpuIdx] ?? 0.0;
    const start = priceVector[priceVector.length - 1];

    return {
      cpuSec,
      envSec,
      start,
    };
  }

  /**
   * Validates if the proposal satisfies basic business rules, is complete and thus safe to interact with
   *
   * Use this method before executing any important logic, to ensure that you're working with correct, complete data
   */
  protected validate(): void | never {
    const usageVector = this.properties["golem.com.usage.vector"];
    const priceVector = this.properties["golem.com.pricing.model.linear.coeffs"];

    if (!usageVector || usageVector.length === 0) {
      throw new GolemError("Broken proposal: the `golem.com.usage.vector` does not contain price information");
    }

    if (!priceVector || priceVector.length === 0) {
      throw new GolemError(
        "Broken proposal: the `golem.com.pricing.model.linear.coeffs` does not contain pricing information",
      );
    }

    if (usageVector.length < priceVector.length - 1) {
      throw new GolemError(
        "Broken proposal: the `golem.com.usage.vector` has less pricing information than `golem.com.pricing.model.linear.coeffs`",
      );
    }

    if (priceVector.length < usageVector.length) {
      throw new GolemError(
        "Broken proposal: the `golem.com.pricing.model.linear.coeffs` should contain 3 price values",
      );
    }
  }

  isInitial(): boolean {
    return this.state === ProposalAllOfStateEnum.Initial;
  }

  isDraft(): boolean {
    return this.state === ProposalAllOfStateEnum.Draft;
  }

  isExpired(): boolean {
    return this.state === ProposalAllOfStateEnum.Expired;
  }

  isRejected(): boolean {
    return this.state === ProposalAllOfStateEnum.Rejected;
  }

  async reject(reason = "no reason") {
    // eslint-disable-next-line @typescript-eslint/ban-types
    await this.api.rejectProposalOffer(this.subscriptionId, this.id, { message: reason as {} }).catch((e) => {
      throw new GolemError(e?.response?.data?.message || e);
    });
    this.eventTarget?.dispatchEvent(
      new Events.ProposalRejected({
        id: this.id,
        provider: this.provider,
        parentId: this.id,
        reason,
      }),
    );
  }

  async respond(chosenPlatform: string) {
    (this.demandRequest.properties as ProposalProperties)["golem.com.payment.chosen-platform"] = chosenPlatform;
    const { data: counteringProposalId } = await this.api
      .counterProposalDemand(this.subscriptionId, this.id, this.demandRequest, { timeout: 20000 })
      .catch((e) => {
        const reason = e?.response?.data?.message || e.toString();
        this.eventTarget?.dispatchEvent(
          new Events.ProposalFailed({
            id: this.id,
            provider: this.provider,
            parentId: this.id,
            reason,
          }),
        );
        throw new GolemError(reason);
      });

    if (this.setCounteringProposalReference) {
      this.setCounteringProposalReference(this.id, counteringProposalId);
    }
    this.eventTarget?.dispatchEvent(
      new Events.ProposalResponded({
        id: this.id,
        provider: this.provider,
        counteringProposalId: counteringProposalId,
      }),
    );
    return counteringProposalId;
  }

  hasPaymentPlatform(paymentPlatform: string): boolean {
    return this.getProviderPaymentPlatforms().includes(paymentPlatform);
  }

  private getProviderPaymentPlatforms(): string[] {
    return (
      Object.keys(this.properties)
        .filter((prop) => prop.startsWith("golem.com.payment.platform."))
        .map((prop) => prop.split(".")[4]) || []
    );
  }

  private getProviderInfo(): ProviderInfo {
    return {
      id: this.issuerId,
      name: this.properties["golem.node.id.name"],
      walletAddress: this.properties[`golem.com.payment.platform.${this.paymentPlatform}.address`] as string,
    };
  }
}
