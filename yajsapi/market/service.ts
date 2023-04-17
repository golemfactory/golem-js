import { Logger } from "../utils/index.js";
import { Package } from "../package/index.js";
import { Demand, Proposal, DemandEventType, DemandOptions } from "./index.js";
import { DefaultMarketStrategy, MarketStrategy, SCORE_NEUTRAL } from "./strategy.js";
import { AgreementPoolService } from "../agreement/index.js";
import { Allocation } from "../payment/index.js";
import { DemandEvent } from "./demand.js";
import { MarketConfig } from "./config.js";
import { sleep } from "../utils/index.js";

/**
 * @internal
 */
export interface MarketOptions extends DemandOptions {
  /** Strategy used to choose best offer */
  strategy?: MarketStrategy;
  debitNotesAcceptanceTimeout?: number;
}

/**
 * Market Service
 * @description Service used in {@link TaskExecutor}
 * @internal
 */
export class MarketService {
  private readonly options: MarketConfig;
  private marketStrategy: MarketStrategy;
  private demand?: Demand;
  private allowedPaymentPlatforms: string[] = [];
  private logger?: Logger;
  private taskPackage?: Package;
  private allocations?: Allocation[];
  private maxResubscribeRetries = 5;

  constructor(private readonly agreementPoolService: AgreementPoolService, options?: MarketOptions) {
    this.options = new MarketConfig(options);
    this.marketStrategy = options?.strategy || new DefaultMarketStrategy(this.agreementPoolService, this.logger);
    this.logger = this.options?.logger;
  }
  async run(taskPackage: Package, allocations: Allocation[]) {
    this.taskPackage = taskPackage;
    this.allocations = allocations;
    for (const allocation of allocations) {
      if (allocation.paymentPlatform) this.allowedPaymentPlatforms.push(allocation.paymentPlatform);
    }
    await this.createDemand();
    this.logger?.debug("Market Service has started");
  }

  async end() {
    if (this.demand) {
      this.demand.removeEventListener(DemandEventType, this.demandEventListener.bind(this));
      await this.demand.unsubscribe().catch((e) => this.logger?.error(`Could not unsubscribe demand. ${e}`));
    }
    this.logger?.debug("Market Service has been stopped");
  }

  private async createDemand(): Promise<true> {
    if (!this.taskPackage) throw new Error("There is no defined Task Package");
    if (!this.allocations) throw new Error("There is no defined Allocations");
    this.demand = await Demand.create(this.taskPackage, this.allocations, this.options);
    this.demand.addEventListener(DemandEventType, this.demandEventListener.bind(this));
    this.logger?.debug(`New demand has been created (${this.demand.id})`);
    return true;
  }

  private demandEventListener(event: Event) {
    const proposal = (event as DemandEvent).proposal;
    if ((event as DemandEvent).error) {
      this.logger?.error("Subscription expired. Trying to subscribe a new one...");
      this.resubscribeDemand().then();
      return;
    }
    if (proposal.isInitial()) this.processInitialProposal(proposal);
    else if (proposal.isDraft()) this.processDraftProposal(proposal);
    else if (proposal.isExpired()) this.logger?.debug(`Proposal hes expired ${proposal.id}`);
    else if (proposal.isRejected()) this.logger?.debug(`Proposal hes rejected ${proposal.id}`);
  }

  private async resubscribeDemand() {
    if (this.demand) {
      this.demand.removeEventListener(DemandEventType, this.demandEventListener.bind(this));
      await this.demand.unsubscribe().catch((e) => this.logger?.error(`Could not unsubscribe demand. ${e}`));
    }
    let attempt = 1;
    let success = false;
    while (!success && attempt <= this.maxResubscribeRetries) {
      success = await this.createDemand().catch((e) => this.logger?.error(`Could not resubscribe demand. ${e}`));
      ++attempt;
      await sleep(20);
    }
  }

  private async processInitialProposal(proposal: Proposal) {
    this.logger?.debug(`New proposal has been received (${proposal.id})`);
    const score = this.marketStrategy.scoreProposal(proposal);
    proposal.score = score;
    this.logger?.debug(`Scored proposal ${proposal.id}. Score: ${score}`);
    try {
      const { result: isProposalValid, reason } = this.isProposalValid(proposal);
      if (isProposalValid) {
        const chosenPlatform = this.getCommonPaymentPlatforms(proposal.properties)![0];
        await proposal
          .respond(chosenPlatform)
          .catch((e) => this.logger?.debug(`Unable to respond proposal ${proposal.id}. ${e}`));
        this.logger?.debug(`Proposal has been responded (${proposal.id})`);
      } else {
        this.logger?.debug(`Proposal has been rejected (${proposal.id}). Reason: ${reason}`);
      }
    } catch (error) {
      this.logger?.error(error);
    }
  }

  private isProposalValid(proposal: Proposal): { result: boolean; reason?: string } {
    const timeout = proposal.properties["golem.com.payment.debit-notes.accept-timeout?"];
    if (timeout && timeout < this.options.debitNotesAcceptanceTimeout)
      return { result: false, reason: "Debit note acceptance timeout too short" };
    const commonPaymentPlatforms = this.getCommonPaymentPlatforms(proposal.properties);
    if (!commonPaymentPlatforms?.length) return { result: false, reason: "No common payment platform" };
    if (proposal.score && proposal.score < SCORE_NEUTRAL) return { result: false, reason: "Score is to low" };
    return { result: true };
  }

  private async processDraftProposal(proposal: Proposal) {
    this.agreementPoolService.addProposal(proposal.id);
    this.logger?.debug(
      `Proposal has been confirmed with provider ${proposal.issuerId} and added to agreement pool (${proposal.id})`
    );
  }

  private getCommonPaymentPlatforms(proposalProperties): string[] | undefined {
    const providerPlatforms = Object.keys(proposalProperties)
      .filter((prop) => prop.startsWith("golem.com.payment.platform."))
      .map((prop) => prop.split(".")[4]) || ["NGNT"];
    return this.allowedPaymentPlatforms.filter((p) => providerPlatforms.includes(p));
  }
}
