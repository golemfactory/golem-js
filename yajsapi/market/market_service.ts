import { dayjs, Logger } from "../utils";
import { EventBus } from "../events/event_bus";
import { Package } from "../package";
import { Demand } from "./demand";
import { Subscription } from "./subscription";
import { DefaultMarketStrategy, MarketStrategy } from "./strategy";
import { Offer, Proposal } from "./offer";
import { RequestorApi as MarketApi, Configuration } from "ya-ts-client/dist/ya-market";
import { PaymentService } from "../payment";
import { AgreementPoolService } from "../agreement";
import { YagnaOptions } from "../executor";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";
import { NodeInfo as NodeProp, Activity as ActivityProp, NodeInfoKeys } from "../props";

export type MarketOptions = {
  budget: number;
  paymentNetwork: string;
  paymentDriver: string;
  subnetTag: string;
  timeout?: number;
};

export class MarketService {
  private api: MarketApi;
  private marketStrategy: MarketStrategy;

  constructor(
    private readonly yagnaOptions: YagnaOptions,
    private readonly marketOptions: MarketOptions,
    private readonly paymentService: PaymentService,
    private readonly agreementPoolService: AgreementPoolService,
    private readonly eventBus: EventBus,
    private readonly logger?: Logger,
    marketStrategy?: MarketStrategy
  ) {
    this.marketStrategy = marketStrategy || new DefaultMarketStrategy(this.agreementPoolService);
    const apiConfig = new Configuration({
      apiKey: yagnaOptions.apiKey,
      basePath: yagnaOptions.basePath + "/market-api/v1",
      accessToken: yagnaOptions.apiKey,
    });
    this.api = new MarketApi(apiConfig);
  }
  async run(taskPackage: Package) {
    this.logger?.debug("Market Service has started");
    const demand = await this.createDemand(taskPackage);
    const subscription = await this.publishDemand(demand);
    const allowedPlatforms = await this.paymentService.getAllocatedPaymentPlatform();
    subscription.listenForNewProposalAndOffers(allowedPlatforms).catch((e) => {
      throw new Error("Cannot getting new offers from market. " + e);
    });
    subscription.on("proposal", (proposal) => this.processProposal(proposal));
    subscription.on("offer", (offer) => this.processOffer(offer));
  }

  async end() {
    // todo
  }

  private async createDemand(taskPackage: Package): Promise<Demand> {
    const baseDecoration = this.getBaseDecoration();
    const packageDecoration = await taskPackage.getDemandDecoration();
    const marketDecoration = await this.paymentService.getDemandDecoration(this.marketOptions);
    const strategyDecoration = this.marketStrategy.getDemandDecoration();
    return new Demand([baseDecoration, packageDecoration, marketDecoration, strategyDecoration]);
  }

  private async publishDemand(demand: Demand): Promise<Subscription> {
    const demandRequest = demand.getDemandRequest();
    const { data: subscriptionId } = await this.api.subscribeDemand(demandRequest);
    this.logger?.debug(`Demand published on the market.`);
    return new Subscription(subscriptionId, demand, this.api);
  }

  private async processProposal(proposal: Proposal) {
    this.logger?.debug(`A New proposal has been received (${proposal.proposalId}).`);
    this.eventBus.emit("NewProposal", proposal);
    const score = this.marketStrategy.scoreProposal(proposal);
    proposal.setScore(score);
    const { result: isAcceptable, reason } = proposal.isAcceptable();
    try {
      if (isAcceptable) {
        await proposal.respond();
        this.eventBus.emit("ProposalResponded");
      } else {
        await proposal.reject(reason);
        this.eventBus.emit("ProposalRejected");
      }
    } catch (error) {
      this.logger?.error(error);
    }
  }

  private async processOffer(offer: Offer) {
    this.eventBus.emit("NewOffer", offer);
    this.logger?.debug(`A New offer has been confirmed (${offer.proposalId}).`);
    this.agreementPoolService.addOffer(offer);
  }

  private getBaseDecoration(): MarketDecoration {
    const activityProp = new ActivityProp();
    activityProp.expiration.value = dayjs().add(this.marketOptions.timeout!, "ms");
    activityProp.multi_activity.value = true;
    const nodeProp = new NodeProp(this.marketOptions.subnetTag);
    return {
      properties: [...activityProp.properties(), ...nodeProp.properties()],
      constraints: [`(${NodeInfoKeys.subnet_tag}=${this.marketOptions.subnetTag})`],
    };
  }
}
