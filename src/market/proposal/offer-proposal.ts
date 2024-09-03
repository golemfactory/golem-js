import { MarketApi } from "ya-ts-client";
import { GolemMarketError, MarketErrorCode } from "../error";
import { ProviderInfo } from "../agreement";
import { Demand } from "../demand";
import { GolemInternalError } from "../../shared/error/golem-error";
import { MarketProposal } from "./market-proposal";

export type OfferProposalFilter = (proposal: OfferProposal) => boolean;

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
  runtimeVersion: string;
  state: ProposalState;
}>;

/**
 * Entity representing the offer presented by the Provider to the Requestor
 *
 * Issue: The final proposal that gets promoted to an agreement comes from the provider
 * Right now the last time I can access it directly is when I receive the counter from the provider,
 * later it's impossible for me to get it via the API `{"message":"Path deserialize error: Id [2cb0b2820c6142fab5af7a8e90da09f0] has invalid owner type."}`
 *
 * FIXME #yagna should allow obtaining proposals via the API even if I'm not the owner!
 */
export class OfferProposal extends MarketProposal {
  public readonly issuer = "Provider";

  constructor(
    model: MarketApi.ProposalDTO,
    public readonly demand: Demand,
  ) {
    super(model);

    this.validate();
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
      runtimeVersion: this.properties["golem.runtime.version"],
      state: this.state,
    };
  }

  /**
   * Proposal cost estimation based on CPU, Env and startup costs
   *
   * @param rentHours Number of hours of rental to use for the estimation
   */
  getEstimatedCost(rentHours = 1): number {
    const threadsNo = this.properties["golem.inf.cpu.threads"] ?? 1;
    const rentSeconds = rentHours * 60 * 60;

    return this.pricing.start + this.pricing.cpuSec * threadsNo * rentSeconds + this.pricing.envSec * rentSeconds;
  }

  public get provider(): ProviderInfo {
    return {
      id: this.model.issuerId,
      name: this.properties["golem.node.id.name"],
      walletAddress: this.properties[`golem.com.payment.platform.${this.demand.paymentPlatform}.address`] as string,
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

  private getProviderPaymentPlatforms(): string[] {
    return (
      Object.keys(this.properties)
        .filter((prop) => prop.startsWith("golem.com.payment.platform."))
        .map((prop) => prop.split(".")[4]) || []
    );
  }
}
