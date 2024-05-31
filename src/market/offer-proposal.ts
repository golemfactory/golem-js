import { MarketApi } from "ya-ts-client";
import { GolemMarketError, MarketErrorCode } from "./error";
import { ProviderInfo } from "./agreement";
import { Demand } from "./demand";
import { GolemInternalError } from "../shared/error/golem-error";
import { ProposalProperties } from "./proposal-properties";

export type ProposalFilter = (proposal: OfferProposal) => boolean;

export type PricingInfo = {
  cpuSec: number;
  envSec: number;
  start: number;
};

export type ProposalState = "Initial" | "Draft" | "Rejected" | "Accepted" | "Expired";

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
  state: ProposalState;
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
    private readonly model: MarketApi.ProposalDTO,
    public readonly issuer: "Provider" | "Requestor",
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
    // Why issuer === Provider?
    //
    // Yagna, and our current implementation shares the same type for the "market negotiated proposals" that
    // the Provider and the Requestor exchange interchangeably. The problem is that when the Requestor issues his
    // demand in form of a counter-proposal, it provides way less properties on his "market object" compared to
    // the one that the Provider presents. As a result, the counter-offers produced by the Requestor would not pass
    // the validation that's designed to validate offers from Providers.
    //
    // In the long term, we might want to differentiate these types if we want to impose some validation rules for
    // the counter-proposals produced by Requestors.
    if (this.issuer === "Provider") {
      const usageVector = this.properties["golem.com.usage.vector"];
      const priceVector = this.properties["golem.com.pricing.model.linear.coeffs"];

      if (!usageVector || usageVector.length === 0) {
        throw new GolemMarketError(
          "Broken proposal: the `golem.com.usage.vector` does not contain valid information about structure of the usage counters vector",
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

  isCounterProposal() {
    return this.issuer === "Requestor";
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
      name: this.properties["golem.node.id.name"],
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
