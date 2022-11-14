import { Logger } from "../utils";
import { EventBus } from "../events/event_bus";
import { Package } from "../package";
import { Demand } from "./demand";
import { Subscription } from "./subscription";

export class MarketService {
  constructor(
    private readonly yagnaOptions: { apiKey?: string; apiUrl?: string },
    private readonly eventBus: EventBus,
    private readonly logger?: Logger
  ) {}
  async run(taskPackage: Package) {
    this.logger?.info("The Market Service has started");
    const demand = await this.createDemand(taskPackage);
    const subscriptionId = await this.publishDemand(demand);
    const subscription = this.createSubscription(subscriptionId);
    subscription.on("offer", this.eventBus.emit);
  }

  async end() {
    // todo
  }

  private async createDemand(taskPackage: Package): Promise<Demand> {
    return new Demand();
  }

  private async publishDemand(demand: Demand): Promise<string> {
    return "todo";
  }

  private createSubscription(subscriptionId: string): Subscription {
    return new Subscription();
  }
}
