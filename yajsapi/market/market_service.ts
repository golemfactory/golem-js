import { Logger } from "../utils";
import { EventBus } from "../events/event_bus";
import { Package } from "../package";
import { Demand } from "../core";
import { DefaultMarketStrategy, MarketStrategy, SCORE_NEUTRAL } from "./strategy";
import { Offer, Proposal } from "../core";
import { RequestorApi as MarketApi, Configuration } from "ya-ts-client/dist/ya-market";
import { PaymentService } from "../payment";
import { AgreementPoolService } from "../agreement";
import { YagnaOptions } from "../executor";

export type MarketOptions = {
  budget: number;
  payment: { driver: string; network: string };
  subnetTag: string;
  timeout?: number;
};

export class MarketService {
  private readonly api: MarketApi;
  private marketStrategy: MarketStrategy;
  private demand?: Demand;

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
    const allocations = await this.paymentService.createAllocations(this.marketOptions).catch((e) => {
      throw new Error(`Could not create allocation ${e}`);
    });
    this.demand = await Demand.create(taskPackage, allocations, {
      subnetTag: this.marketOptions.subnetTag,
      timeout: this.marketOptions.timeout,
      yagnaOptions: this.yagnaOptions,
    });
    this.logger?.info("Demand published on the market");
    this.demand.on("proposal", (proposal) => this.processProposal(proposal));
    this.demand.on("offer", (offer) => this.processOffer(offer));
  }

  async end() {
    if (this.demand) {
      await this.demand?.unsubscribe().catch((e) => this.logger?.error(`Could not unsubscribe demand. ${e}`));
      this.demand?.removeAllListeners();
      this.logger?.debug(`Subscription ${this.demand.id} unsubscribed`);
    }
    this.logger?.debug("Market Service has been stopped");
  }

  private async processProposal(proposal: Proposal) {
    this.logger?.debug(`New proposal has been received (${proposal.proposalId})`);
    this.eventBus.emit("NewProposal", proposal);
    const score = this.marketStrategy.scoreProposal(proposal);
    proposal.setScore(score);
    this.logger?.debug(`Scored proposal ${proposal.proposalId}. Score: ${score}`);
    try {
      if (proposal.score >= SCORE_NEUTRAL) {
        await proposal.respond();
        this.logger?.debug(`Proposal hes been responded (${proposal.proposalId})`);
      } else {
        await proposal.reject("Score is to low");
        this.logger?.debug(`Proposal hes been rejected (${proposal.proposalId}). Reason: Score is to low`);
      }
    } catch (error) {
      this.logger?.error(error);
    }
  }

  private async processOffer(offer: Offer) {
    this.eventBus.emit("NewOffer", offer);
    this.logger?.debug(`New offer has been confirmed (${offer.proposalId})`);
    this.agreementPoolService.addProposal(offer);
  }
}
