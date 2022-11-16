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

const SCORE_NEUTRAL = 1.0;

export class MarketService {
  private api: MarketApi;

  constructor(
    private readonly yagnaOptions: { apiKey?: string; basePath?: string },
    private readonly marketOptions: { budget: number; paymentNetwork: string; paymentDriver: string },
    private readonly paymentService: PaymentService,
    private readonly agreementPoolService: AgreementPoolService,
    private readonly marketStrategy: MarketStrategy,
    private readonly eventBus: EventBus,
    private readonly logger?: Logger
  ) {
    if (!this.marketStrategy) this.marketStrategy = new DefaultMarketStrategy();
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
    const offer = demand.getOffer();
    const { data: subscriptionId } = await this.api.subscribeDemand(offer);
    return new Subscription(subscriptionId);
  }

  private async processProposal(proposal: Proposal) {
    this.eventBus.emit("NewProposal", proposal);
    const score = this.marketStrategy.scoreProposal(proposal);
    proposal.setScore(score);
    if (proposal.isAcceptable()) await proposal.respond();
    else proposal.reject();
  }

  private async processOffer(offer: Offer) {
    this.eventBus.emit("NewOffer", offer);
    this.agreementPoolService.addOffer(offer);
  }
}
