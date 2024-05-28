import { MarketApi } from "ya-ts-client";
import { GolemMarketError, MarketErrorCode } from "./error";
import { ProviderInfo } from "./agreement";
import { Demand } from "./demand";
import { GolemInternalError } from "../shared/error/golem-error";

export type ProposalFilter = (proposal: OfferProposal) => boolean;

export type PricingInfo = {
  cpuSec: number;
  envSec: number;
  start: number;
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export type ProposalProperties = Record<string, string | number | string[] | number[] | boolean> &
  /**
   * This type is made Partial on purpose. Golem Protocol defines "properties" as a flat list of key/value pairs.
   *
   * The protocol itself does not dictate what properties should or shouldn't be defined. Such details
   * are left for the Provider and Requestor to agree upon outside the protocol.
   *
   * The mentioned agreements can be done in a P2P manner between the involved entities, or both parties
   * can decide to adhere to a specific "standard" which determines which properties are "mandatory".
   *
   * One example of such standard would be:
   * https://github.com/golemfactory/golem-architecture/blob/master/gaps/gap-3_mid_agreement_payments/gap-3_mid_agreement_payments.md
   *
   * golem-js in its current form partially implements some of the standards, but it's not committed to implementing them fully
   */

  Partial<{
    "golem.activity.caps.transfer.protocol": string[];
    "golem.com.payment.debit-notes.accept-timeout?": number;
    "golem.com.payment.platform.erc20-polygon-glm.address"?: string;
    "golem.com.payment.platform.erc20-holesky-tglm.address"?: string;
    "golem.com.payment.platform.erc20-mumbai-tglm.address"?: string;
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
  }>;

export type ProposalDTO = Partial<{
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
  state: MarketApi.ProposalDTO["state"];
}>;

export interface IProposalRepository {
  add(proposal: OfferProposal): OfferProposal;
  getById(id: string): OfferProposal | undefined;
  getByDemandAndId(demand: Demand, id: string): Promise<OfferProposal>;
}

/**
 * Entity representing the offer presented by the Provider to the Requestor
 *
 * Issue: The final proposal that gets promoted to an agreement comes from the provider
 * Right now the last time I can acces it directly is when I receive the counter from the provider,
 * later it's impossible for me to get it via the API `{"message":"Path deserialize error: Id [2cb0b2820c6142fab5af7a8e90da09f0] has invalid owner type."}`
 *
 * FIXME #yagna should allow obtaining proposals via the API even if I'm not the owner!
 */
export class OfferProposal {
  public readonly id: string;
  public provider: ProviderInfo;
  public readonly previousProposalId: string | null = null;

  constructor(
    public readonly model: MarketApi.ProposalDTO,
    public readonly demand: Demand,
  ) {
    this.id = model.proposalId;
    this.provider = this.getProviderInfo();
    this.previousProposalId = model.prevProposalId ?? null;

    this.validate();
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
      throw new GolemMarketError(
        "Broken proposal: the `golem.com.usage.vector` does not contain price information",
        MarketErrorCode.InvalidProposal,
      );
    }

    if (!priceVector || priceVector.length === 0) {
      throw new GolemMarketError(
        "Broken proposal: the `golem.com.pricing.model.linear.coeffs` does not contain pricing information",
        MarketErrorCode.InvalidProposal,
      );
    }

    if (usageVector.length < priceVector.length - 1) {
      throw new GolemMarketError(
        "Broken proposal: the `golem.com.usage.vector` has less pricing information than `golem.com.pricing.model.linear.coeffs`",
        MarketErrorCode.InvalidProposal,
      );
    }

    if (priceVector.length < usageVector.length) {
      throw new GolemMarketError(
        "Broken proposal: the `golem.com.pricing.model.linear.coeffs` should contain 3 price values",
        MarketErrorCode.InvalidProposal,
      );
    }
  }

  isInitial(): boolean {
    return this.model.state === "Initial";
  }

  isDraft(): boolean {
    return this.model.state === "Draft";
  }

  isExpired(): boolean {
    return this.model.state === "Expired";
  }

  isRejected(): boolean {
    return this.model.state === "Rejected";
  }

  public get properties(): ProposalProperties {
    return this.model.properties as ProposalProperties;
  }

  public get state(): MarketApi.ProposalDTO["state"] {
    return this.model.state;
  }

  public get timestamp(): string {
    return this.model.timestamp;
  }

  getDto(): ProposalDTO {
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

    if (!usageVector) {
      throw new GolemInternalError(
        "The proposal does not contain 'golem.com.usage.vector' property. We can't estimate the costs.",
      );
    }

    if (!priceVector) {
      throw new GolemInternalError(
        "The proposal does not contain 'golem.com.pricing.model.linear.coeffs' property. We can't estimate costs.",
      );
    }

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
   * Proposal cost estimation based on CPU, Env and startup costs
   */
  getEstimatedCost(): number {
    const threadsNo = this.properties["golem.inf.cpu.threads"] || 1;
    return this.pricing.start + this.pricing.cpuSec * threadsNo + this.pricing.envSec;
  }

  public isValid(): boolean {
    try {
      this.validate();
      return true;
    } catch (err) {
      return false;
    }
  }

  public getProviderInfo(): ProviderInfo {
    return {
      id: this.model.issuerId,
      name: this.properties["golem.node.id.name"] ?? "",
      walletAddress: this.properties[`golem.com.payment.platform.${this.demand.paymentPlatform}.address`] as string,
    };
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
}
