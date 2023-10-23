import { YagnaApi, Logger, sleep } from "../utils";
import { Package } from "../package";
import { Proposal } from "./proposal";
import { AgreementPoolService } from "../agreement";
import { Allocation } from "../payment";
import { Demand, DemandEvent, DemandEventType, DemandOptions } from "./demand";
import { MarketConfig } from "./config";

export type ProposalFilter = (proposal: Proposal) => Promise<boolean> | boolean;

export interface MarketOptions extends DemandOptions {
  /** A custom filter that checks every proposal coming from the market */
  proposalFilter?: ProposalFilter;
  /** Maximum time for debit note acceptance*/
  debitNotesAcceptanceTimeout?: number;
}

/**
 * Market Service
 * @description Service used in {@link TaskExecutor}
 * @internal
 */
export class MarketService {
  private readonly options: MarketConfig;
  private demand?: Demand;
  private allocation?: Allocation;
  private logger?: Logger;
  private taskPackage?: Package;
  private maxResubscribeRetries = 5;
  private proposalsCount = {
    initial: 0,
    confirmed: 0,
    rejected: 0,
  };

  constructor(
    private readonly agreementPoolService: AgreementPoolService,
    private readonly yagnaApi: YagnaApi,
    options?: MarketOptions,
  ) {
    this.options = new MarketConfig(options);
    this.logger = this.options?.logger;
  }

  async run(taskPackage: Package, allocation: Allocation) {
    this.taskPackage = taskPackage;
    this.allocation = allocation;
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

  getProposalsCount() {
    return this.proposalsCount;
  }
  private async createDemand(): Promise<true> {
    if (!this.taskPackage || !this.allocation) throw new Error("The service has not been started correctly.");
    this.demand = await Demand.create(this.taskPackage, this.allocation, this.yagnaApi, this.options);
    this.demand.addEventListener(DemandEventType, this.demandEventListener.bind(this));
    this.proposalsCount = {
      initial: 0,
      confirmed: 0,
      rejected: 0,
    };
    this.logger?.debug(`New demand has been created (${this.demand.id})`);
    return true;
  }

  private demandEventListener(event: Event) {
    const proposal = (event as DemandEvent).proposal;
    const error = (event as DemandEvent).error;
    if (error) {
      this.logger?.error("Subscription failed. Trying to subscribe a new one...");
      this.resubscribeDemand().catch((e) => this.logger?.warn(e));
      return;
    }
    if (proposal.isInitial()) this.processInitialProposal(proposal);
    else if (proposal.isDraft()) this.processDraftProposal(proposal);
    else if (proposal.isExpired()) this.logger?.debug(`Proposal hes expired ${proposal.id}`);
    else if (proposal.isRejected()) {
      this.proposalsCount.rejected++;
      this.logger?.debug(`Proposal hes rejected ${proposal.id}`);
    }
  }

  private async resubscribeDemand() {
    if (this.demand) {
      this.demand.removeEventListener(DemandEventType, this.demandEventListener.bind(this));
      await this.demand.unsubscribe().catch((e) => this.logger?.debug(`Could not unsubscribe demand. ${e}`));
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
    if (!this.allocation) throw new Error("The service has not been started correctly.");
    this.logger?.debug(`New proposal has been received (${proposal.id})`);
    this.proposalsCount.initial++;
    try {
      const { result: isProposalValid, reason } = await this.isProposalValid(proposal);
      if (isProposalValid) {
        const chosenPlatform = this.allocation.paymentPlatform;
        await proposal
          .respond(chosenPlatform)
          .catch((e) => this.logger?.debug(`Unable to respond proposal ${proposal.id}. ${e}`));
        this.logger?.debug(`Proposal has been responded (${proposal.id})`);
      } else {
        this.proposalsCount.rejected++;
        this.logger?.debug(`Proposal has been rejected (${proposal.id}). Reason: ${reason}`);
      }
    } catch (error) {
      this.logger?.error(error);
    }
  }

  private async isProposalValid(proposal: Proposal): Promise<{ result: boolean; reason?: string }> {
    if (!this.allocation) throw new Error("The service has not been started correctly.");
    const timeout = proposal.properties["golem.com.payment.debit-notes.accept-timeout?"];
    if (timeout && timeout < this.options.debitNotesAcceptanceTimeout)
      return { result: false, reason: "Debit note acceptance timeout too short" };
    if (!proposal.hasPaymentPlatform(this.allocation.paymentPlatform))
      return { result: false, reason: "No common payment platform" };
    if (!(await this.options.proposalFilter(proposal)))
      return { result: false, reason: "Proposal rejected by Proposal Filter" };
    return { result: true };
  }

  private async processDraftProposal(proposal: Proposal) {
    await this.agreementPoolService.addProposal(proposal);
    this.proposalsCount.confirmed++;
    this.logger?.debug(
      `Proposal has been confirmed with provider ${proposal.issuerId} and added to agreement pool (${proposal.id})`,
    );
  }
}
