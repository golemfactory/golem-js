import { Logger } from "../utils";
import { EventBus } from "../events/event_bus";
import { Package } from "../package";
import { Demand } from "./demand";
import { Subscription } from "./subscription";
import { DefaultMarketStrategy, MarketStrategy } from "./strategy";
import { Offer, Proposal } from "./offer";
import { RequestorApi as MarketApi, Configuration } from "ya-ts-client/dist/ya-market";
import { PaymentService } from "../payment";
import { AgreementPoolService } from "../agreement";

export class MarketService {
  private api: MarketApi;
  private marketStrategy: MarketStrategy;

  constructor(
    private readonly yagnaOptions: { apiKey?: string; basePath?: string },
    private readonly marketOptions: { budget: number; paymentNetwork: string; paymentDriver: string },
    private readonly paymentService: PaymentService,
    private readonly agreementPoolService: AgreementPoolService,
    private readonly eventBus: EventBus,
    private readonly logger?: Logger,
    marketStrategy?: MarketStrategy
  ) {
    this.marketStrategy = marketStrategy || new DefaultMarketStrategy(this.agreementPoolService);
    const apiConfig = new Configuration({
      apiKey: yagnaOptions.apiKey,
      basePath: yagnaOptions.basePath,
      accessToken: yagnaOptions.apiKey,
    });
    this.api = new MarketApi(apiConfig);
  }
  async run(taskPackage: Package) {
    this.logger?.info("The Market Service has started");
    const demand = await this.createDemand(taskPackage);
    const subscription = await this.publishDemand(demand);
    await subscription.on("proposal", (proposal) => this.processProposal(proposal));
    await subscription.on("offer", (offer) => this.processOffer(offer));
  }

  async end() {
    // todo
  }

  private async createDemand(taskPackage: Package): Promise<Demand> {
    const packageDecoration = await taskPackage.getDemandDecoration();
    const marketDecoration = await this.paymentService.getDemandDecoration(this.marketOptions);
    const strategyDecoration = this.marketStrategy.getDemandDecoration();
    return new Demand([packageDecoration, marketDecoration, strategyDecoration]);
  }

  private async publishDemand(demand: Demand): Promise<Subscription> {
    const demandRequest = demand.getDemandRequest();
    const { data: subscriptionId } = await this.api.subscribeDemand(demandRequest);
    return new Subscription(subscriptionId, this.api);
  }

  private async processProposal(proposal: Proposal) {
    this.eventBus.emit("NewProposal", proposal);
    const score = this.marketStrategy.scoreProposal(proposal);
    proposal.setScore(score);
    if (proposal.isAcceptable()) {
      await proposal.respond();
      this.eventBus.emit("ProposalResponded");
    } else {
      await proposal.reject();
      this.eventBus.emit("ProposalRejected");
    }
  }

  private async processOffer(offer: Offer) {
    this.eventBus.emit("NewOffer", offer);
    this.agreementPoolService.addOffer(offer);
  }
}
