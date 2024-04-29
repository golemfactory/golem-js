import { MarketApi } from "ya-ts-client";
import { GolemMarketError, MarketErrorCode } from "./error";
import { ProviderInfo } from "../agreement";
import { Demand, DemandNew } from "./demand";
import { withTimeout } from "../shared/utils/timeout";
import { EventEmitter } from "eventemitter3";

export interface ProposalEvents {
  proposalResponded: (details: { id: string; provider: ProviderInfo; counteringProposalId: string }) => void;
  proposalRejected: (details: { id: string; provider: ProviderInfo; parentId: string | null; reason: string }) => void;
  proposalFailed: (details: { id: string; provider: ProviderInfo; parentId: string | null; reason: string }) => void;
}

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
};

export interface ProposalDTO {
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
}

export interface IProposalRepository {
  add(proposal: ProposalNew): ProposalNew;
  getById(id: string): ProposalNew | undefined;
  getByDemandAndId(demand: DemandNew, id: string): Promise<ProposalNew>;
}

/**
 * Issue: The final proposal that gets promoted to an agreement comes from the provider
 * Right now the last time I can acces it directly is when I receive the counter from the provider,
 * later it's impossible for me to get it via the API `{"message":"Path deserialize error: Id [2cb0b2820c6142fab5af7a8e90da09f0] has invalid owner type."}`
 *
 * FIXME #yagna should allow obtaining proposals via the API even if I'm not the owner!
 */
export class ProposalNew {
  public readonly id: string;
  public provider: ProviderInfo;
  public readonly previousProposalId: string | null = null;

  constructor(
    public readonly model: MarketApi.ProposalDTO,
    public readonly demand: DemandNew,
  ) {
    this.id = model.proposalId;
    this.provider = this.getProviderInfo();
    this.previousProposalId = model.prevProposalId ?? null;
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

  public get id(): string {
    return this.model.proposalId;
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

  get timestamp() {
    return this.model.timestamp;
  }

  /**
   * Proposal cost estimation based on CPU, Env and startup costs
   */
  getEstimatedCost(): number {
    const threadsNo = this.properties["golem.inf.cpu.threads"] || 1;
    return this.pricing.start + this.pricing.cpuSec * threadsNo + this.pricing.envSec;
  }

  public isValid(): boolean {
    const usageVector = this.properties["golem.com.usage.vector"];
    const priceVector = this.properties["golem.com.pricing.model.linear.coeffs"];

    if (!usageVector || usageVector.length === 0) {
      return false;
    }

    if (!priceVector || priceVector.length === 0) {
      return false;
    }

    if (usageVector.length < priceVector.length - 1) {
      return false;
    }

    if (priceVector.length < usageVector.length) {
      return false;
    }

    return true;
  }

  public getProviderInfo(): ProviderInfo {
    return {
      id: this.model.issuerId,
      name: this.properties["golem.node.id.name"],
      walletAddress: this.properties[`golem.com.payment.platform.${this.demand.paymentPlatform}.address`] as string,
    };
  }
}

/**
 * Proposal module - an object representing an offer in the state of a proposal from the provider.
 * @deprecated
 */
export class Proposal {
  id: string;
  readonly issuerId: string;
  readonly provider: ProviderInfo;
  readonly properties: ProposalProperties;
  readonly constraints: string;
  readonly timestamp: string;
  counteringProposalId: string | null;
  private readonly state: MarketApi.ProposalDTO["state"];
  private readonly prevProposalId: string | undefined;
  public readonly events = new EventEmitter<ProposalEvents>();

  /**
   * Create proposal for given subscription ID
   *
   * @param demand
   * @param parentId
   * @param setCounteringProposalReference
   * @param api
   * @param model
   */
  constructor(
    public readonly demand: Demand,
    private readonly parentId: string | null,
    private readonly setCounteringProposalReference: (id: string, parentId: string) => void | null,
    private readonly api: MarketApi.RequestorService,
    public readonly model: MarketApi.ProposalDTO,
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

  /**
   * @deprecated Will be removed before release, glue code
   */
  toNewEntity(): ProposalNew {
    return new ProposalNew(this.model, this.demand.toNewEntity());
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
    return this.state === "Initial";
  }

  isDraft(): boolean {
    return this.state === "Draft";
  }

  isExpired(): boolean {
    return this.state === "Expired";
  }

  isRejected(): boolean {
    return this.state === "Rejected";
  }

  async reject(reason = "no reason") {
    try {
      // eslint-disable-next-line @typescript-eslint/ban-types
      await this.api.rejectProposalOffer(this.demand.id, this.id, { message: reason as {} });
      this.events.emit("proposalRejected", {
        id: this.id,
        provider: this.provider,
        parentId: this.id,
        reason,
      });
    } catch (error) {
      throw new GolemMarketError(
        `Failed to reject proposal. ${error?.response?.data?.message || error}`,
        MarketErrorCode.ProposalRejectionFailed,
        error,
      );
    }
  }

  async respond(chosenPlatform: string) {
    try {
      (this.demand.demandRequest.properties as ProposalProperties)["golem.com.payment.chosen-platform"] =
        chosenPlatform;

      const counteringProposalId = await withTimeout(
        this.api.counterProposalDemand(this.demand.id, this.id, this.demand.demandRequest),
        20_000,
      );

      if (!counteringProposalId || typeof counteringProposalId !== "string") {
        throw new GolemMarketError(
          "Failed to respond proposal. No countering proposal ID returned",
          MarketErrorCode.ProposalResponseFailed,
        );
      }
      if (this.setCounteringProposalReference) {
        this.setCounteringProposalReference(this.id, counteringProposalId);
      }
      this.events.emit("proposalResponded", {
        id: this.id,
        provider: this.provider,
        counteringProposalId,
      });
      return counteringProposalId;
    } catch (error) {
      const reason = error?.response?.data?.message || error.toString();
      this.events.emit("proposalFailed", {
        id: this.id,
        provider: this.provider,
        parentId: this.id,
        reason,
      });
      throw new GolemMarketError(
        `Failed to respond proposal. ${reason}`,
        MarketErrorCode.ProposalResponseFailed,
        error,
      );
    }
  }

  hasPaymentPlatform(paymentPlatform: string): boolean {
    return this.getProviderPaymentPlatforms().includes(paymentPlatform);
  }

  /**
   * Proposal cost estimation based on CPU, Env and startup costs
   */
  getEstimatedCost(): number {
    const threadsNo = this.properties["golem.inf.cpu.threads"] || 1;
    return this.pricing.start + this.pricing.cpuSec * threadsNo + this.pricing.envSec;
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
      walletAddress: this.properties[
        `golem.com.payment.platform.${this.demand.allocation.paymentPlatform}.address`
      ] as string,
    };
  }
}
