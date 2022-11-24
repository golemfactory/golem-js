import { Logger } from "../utils";
import { Package } from "../package";
import { Demand } from "../core";
import { DefaultMarketStrategy, MarketStrategy, SCORE_NEUTRAL } from "./strategy";
import { Proposal, DemandEvent } from "../core";
import { PaymentService } from "../payment";
import { AgreementPoolService } from "../agreement";
import { YagnaOptions } from "../executor";

export type MarketOptions = {
  budget?: number;
  payment?: { driver: string; network: string };
  subnetTag?: string;
  timeout?: number;
  yagnaOptions?: YagnaOptions;
};

export class MarketService {
  private marketStrategy: MarketStrategy;
  private demand?: Demand;
  private allowedPaymentPlatforms: string[] = [];

  constructor(
    private readonly paymentService: PaymentService,
    private readonly agreementPoolService: AgreementPoolService,
    private readonly logger?: Logger,
    private readonly options?: MarketOptions,
    marketStrategy?: MarketStrategy
  ) {
    this.marketStrategy = marketStrategy || new DefaultMarketStrategy(this.agreementPoolService);
  }
  async run(taskPackage: Package) {
    const allocations = await this.paymentService
      .createAllocations(this.options?.budget, this.options?.payment, this.options?.timeout)
      .catch((e) => {
        throw new Error(`Could not create allocation ${e}`);
      });
    for (const allocation of allocations) {
      if (allocation.paymentPlatform) this.allowedPaymentPlatforms.push(allocation.paymentPlatform);
    }
    this.demand = await Demand.create(taskPackage, allocations, {
      subnetTag: this.options?.subnetTag,
      timeout: this.options?.timeout,
      yagnaOptions: this.options?.yagnaOptions,
      logger: this.logger,
    });
    this.demand.on(DemandEvent.ProposalReceived, (proposal) => {
      if (proposal.isInitial()) this.processInitialProposal(proposal);
      else if (proposal.isDraft()) this.processDraftProposal(proposal);
      else if (proposal.isExpired()) this.logger?.debug(`Proposal hes expired ${proposal.id}`);
      else if (proposal.isRejected()) this.logger?.debug(`Proposal hes rejected ${proposal.id}`);
    });
    this.logger?.debug("Market Service has started");
  }

  async end() {
    if (this.demand) {
      await this.demand?.unsubscribe().catch((e) => this.logger?.error(`Could not unsubscribe demand. ${e}`));
      this.demand?.removeAllListeners();
    }
    this.logger?.debug("Market Service has been stopped");
  }

  private async processInitialProposal(proposal: Proposal) {
    this.logger?.debug(`New proposal has been received (${proposal.proposalId})`);
    const score = this.marketStrategy.scoreProposal(proposal);
    proposal.score = score;
    this.logger?.debug(`Scored proposal ${proposal.proposalId}. Score: ${score}`);
    try {
      const { result: isProposalValid, reason } = this.isProposalValid(proposal);
      if (isProposalValid) {
        const chosenPlatform = this.getCommonPaymentPlatforms(proposal.properties)![0];
        await proposal.respond(chosenPlatform);
        this.logger?.debug(`Proposal hes been responded (${proposal.proposalId})`);
      } else {
        await proposal.reject(reason);
        this.logger?.debug(`Proposal hes been rejected (${proposal.proposalId}). Reason: ${reason}`);
      }
    } catch (error) {
      this.logger?.error(error);
    }
  }

  private isProposalValid(proposal: Proposal): { result: boolean; reason?: string } {
    const commonPaymentPlatforms = this.getCommonPaymentPlatforms(proposal.properties);
    if (!commonPaymentPlatforms?.length) return { result: false, reason: "No common payment platform" };
    if (proposal.score && proposal.score < SCORE_NEUTRAL) return { result: false, reason: "Score is to low" };
    return { result: true };
  }

  private async processDraftProposal(proposal: Proposal) {
    this.logger?.debug(`Proposal has been confirmed (${proposal.proposalId})`);
    this.agreementPoolService.addProposal(proposal.proposalId);
  }

  private getCommonPaymentPlatforms(proposalProperties): string[] | undefined {
    const providerPlatforms = Object.keys(proposalProperties)
      .filter((prop) => prop.startsWith("golem.com.payment.platform."))
      .map((prop) => prop.split(".")[4]) || ["NGNT"];
    return this.allowedPaymentPlatforms.filter((p) => providerPlatforms.includes(p));
  }
}
