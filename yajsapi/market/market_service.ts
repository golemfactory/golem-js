import { Logger } from "../utils";
import { EventBus } from "../events/event_bus";
import { Package } from "../package";
import { Demand } from "./demand";
import { Subscription } from "./subscription";
import { DefaultMarketStrategy, MarketStrategy } from "./strategy";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";
import { Offer, Proposal } from "./offer";

export class MarketService {
  constructor(
    private readonly yagnaOptions: { apiKey?: string; apiUrl?: string },
    private readonly eventBus: EventBus,
    private readonly marketStrategy?: MarketStrategy,
    private readonly logger?: Logger
  ) {
    if (!this.marketStrategy) this.marketStrategy = new DefaultMarketStrategy();
  }
  async run(taskPackage: Package) {
    this.logger?.info("The Market Service has started");
    const marketDecoration = await this.createAllocation(taskPackage);
    const demand = await this.createDemand(marketDecoration);
    const subscriptionId = await this.publishDemand(demand);
    const subscription = this.createSubscription(subscriptionId);
    await subscription.on("proposal", this.processProposal.bind(this));
    await subscription.on("offer", this.processOffer.bind(this));
  }

  async end() {
    // todo
  }

  private async createAllocation(taskPackage: Package): Promise<MarketDecoration> {
    return {} as MarketDecoration;
  }

  private async createDemand(marketDecoration: MarketDecoration): Promise<Demand> {
    return new Demand(marketDecoration);
  }

  private async publishDemand(demand: Demand): Promise<string> {
    return "todo";
  }

  private createSubscription(subscriptionId: string): Subscription {
    return new Subscription();
  }

  private async processProposal(proposal: Proposal) {}

  private async processOffer(offer: Offer) {
    this.eventBus.emit("NewOffer", offer);
  }
}
