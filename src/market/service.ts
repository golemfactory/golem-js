import { defaultLogger, Logger, sleep, YagnaApi } from "../shared/utils";
import { Package } from "./package";
import { Proposal, ProposalNew } from "./proposal";
import { AgreementPoolService } from "../agreement";
import { Allocation } from "../payment";
import { Demand, DemandOptions } from "./demand";
import { MarketConfig } from "./config";
import { GolemMarketError, MarketErrorCode } from "./error";
import { ProposalsBatch } from "./proposals_batch";
import { GolemError } from "../shared/error/golem-error";

export type ProposalFilterNew = (proposal: ProposalNew) => boolean;
export type ProposalFilter = (proposal: Proposal) => boolean;

export interface MarketServiceOptions extends DemandOptions {
  /**
   * A custom filter checking the proposal from the market for each provider and its hardware configuration.
   * Duplicate proposals from one provider are reduced to the cheapest one.
   */
  proposalFilter?: ProposalFilter;
  /** The minimum number of proposals after which the batch of proposal will be processed in order to avoid duplicates */
  minProposalsBatchSize?: number;
  /** The maximum waiting time for proposals to be batched in order to avoid duplicates */
  proposalsBatchReleaseTimeoutMs?: number;
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
  private logger: Logger;
  private taskPackage?: Package;
  private maxResubscribeRetries = 5;
  private proposalsCount = {
    initial: 0,
    confirmed: 0,
    rejected: 0,
  };
  private proposalsBatch: ProposalsBatch;
  private isRunning = false;

  constructor(
    private readonly agreementPoolService: AgreementPoolService,
    private readonly yagnaApi: YagnaApi,
    options?: MarketServiceOptions,
  ) {
    this.options = new MarketConfig(options);
    this.logger = this.options?.logger || defaultLogger("market");
    this.proposalsBatch = new ProposalsBatch({
      minBatchSize: options?.minProposalsBatchSize,
      releaseTimeoutMs: options?.proposalsBatchReleaseTimeoutMs,
    });
  }

  async run(taskPackage: Package, allocation: Allocation) {
    this.isRunning = true;
    this.taskPackage = taskPackage;
    this.allocation = allocation;
    await this.createDemand();
    this.startProcessingProposalsBatch().catch((e) => this.logger.error("Error processing proposal batch", e));
    this.logger.info("Market Service has started");
  }

  async end() {
    this.isRunning = false;
    if (this.demand) {
      this.demand.events.removeListener("proposalReceived", this.demandProposalEventListener.bind(this));
      this.demand.events.removeListener("proposalReceivedError", this.demandProposalErrorEventListener.bind(this));
      await this.demand.unsubscribe().catch((e) => this.logger.error(`Could not unsubscribe demand.`, e));
    }
    this.logger.info("Market Service has been stopped");
  }

  getProposalsCount() {
    return this.proposalsCount;
  }

  private async createDemand(): Promise<true> {
    if (!this.taskPackage || !this.allocation)
      throw new GolemMarketError(
        "The service has not been started correctly.",
        MarketErrorCode.ServiceNotInitialized,
        this.demand,
      );
    this.demand = await Demand.create(this.taskPackage, this.allocation, this.yagnaApi, this.options);
    this.demand.events.on("proposalReceived", this.demandProposalEventListener.bind(this));
    this.demand.events.on("proposalReceivedError", this.demandProposalErrorEventListener.bind(this));
    this.proposalsCount = {
      initial: 0,
      confirmed: 0,
      rejected: 0,
    };
    this.logger.debug(`New demand has been created`, { id: this.demand.id });
    return true;
  }

  private demandProposalErrorEventListener(error: GolemError) {
    if (error instanceof GolemMarketError && error.code === MarketErrorCode.DemandExpired) {
      this.logger.error("Demand expired. Trying to subscribe a new one...");
      this.resubscribeDemand().catch((e) => this.logger?.warn(`Could not resubscribe demand.`, e));
      return;
    }
    this.logger.error("Collecting offers failed. Trying to subscribe a new demand...");
    this.resubscribeDemand().catch((e) => this.logger?.warn(`Could not resubscribe demand.`, e));
    return;
  }

  private demandProposalEventListener(proposal: Proposal) {
    if (proposal.isInitial()) {
      this.proposalsBatch
        .addProposal(proposal)
        .then(() => this.logger.debug("Added a proposal to the batch"))
        .catch((err) => this.logger.error("Failed to add a proposal to the batch", err));
    } else if (proposal.isDraft()) {
      this.processDraftProposal(proposal).catch((err) => this.logger.error("Failed to process proposal draft", err));
    } else if (proposal.isExpired()) {
      this.logger.debug(`Proposal hes expired`, { id: proposal.id });
    } else if (proposal.isRejected()) {
      this.proposalsCount.rejected++;
      this.logger.debug(`Proposal hes rejected`, { id: proposal.id });
    } else {
      this.logger.warn("Received a proposal in a state that is not handled by the SDK", { proposal });
    }
  }

  private async resubscribeDemand() {
    if (this.demand) {
      this.demand.events.removeListener("proposalReceived", this.demandProposalEventListener.bind(this));
      this.demand.events.removeListener("proposalReceivedError", this.demandProposalErrorEventListener.bind(this));
      await this.demand.unsubscribe().catch((e) => this.logger.error(`Could not unsubscribe demand.`, e));
    }
    let attempt = 1;
    let success = false;
    while (!success && attempt <= this.maxResubscribeRetries) {
      success = Boolean(await this.createDemand().catch((e) => this.logger.error(`Could not resubscribe demand.`, e)));
      ++attempt;
      await sleep(20);
    }
  }

  private async processInitialProposal(proposal: Proposal) {
    if (!this.allocation)
      throw new GolemMarketError(
        "Allocation is missing. The service has not been started correctly.",
        MarketErrorCode.MissingAllocation,
        this.demand,
      );
    this.logger.debug(`New proposal has been received`, { id: proposal.id });
    this.proposalsCount.initial++;
    try {
      const { result: isProposalValid, reason } = await this.isProposalValid(proposal);
      if (isProposalValid) {
        // TODO
        // const chosenPlatform = this.allocation.paymentPlatform;
        // await proposal
        //   .respond(chosenPlatform)
        //   .catch((e) => this.logger.debug(`Unable to respond proposal`, { id: proposal.id, e }));
        this.logger.debug(`Proposal has been responded`, { id: proposal.id });
      } else {
        this.proposalsCount.rejected++;
        this.logger.error(`Proposal has been rejected`, { id: proposal.id, reason });
      }
    } catch (error) {
      this.logger.error(`Unable to respond proposal`, { id: proposal.id, error });
    }
  }

  private async isProposalValid(proposal: Proposal): Promise<{ result: boolean; reason?: string }> {
    if (!this.allocation) {
      throw new GolemMarketError(
        "Allocation is missing. The service has not been started correctly.",
        MarketErrorCode.MissingAllocation,
        this.demand,
      );
    }

    const timeout = proposal.properties["golem.com.payment.debit-notes.accept-timeout?"];
    if (timeout && timeout < this.options.debitNotesAcceptanceTimeoutSec) {
      return { result: false, reason: "Debit note acceptance timeout too short" };
    }

    if (!proposal.hasPaymentPlatform(this.allocation.paymentPlatform)) {
      return { result: false, reason: "No common payment platform" };
    }

    if (!this.options.proposalFilter(proposal)) {
      return { result: false, reason: "Proposal rejected by Proposal Filter" };
    }

    return { result: true };
  }

  private async processDraftProposal(oldProposal: Proposal) {
    const newProposal = oldProposal.toNewEntity();
    await this.agreementPoolService.addProposal(newProposal);
    this.proposalsCount.confirmed++;
    this.logger.debug(`Proposal has been confirmed and added to agreement pool`, {
      providerName: newProposal.provider.name,
      issuerId: newProposal.model.issuerId,
      id: newProposal.id,
    });
  }

  private async startProcessingProposalsBatch() {
    while (this.isRunning) {
      this.logger.debug("Waiting for proposals");
      await this.proposalsBatch.waitForProposals();

      const proposals = await this.proposalsBatch.getProposals();
      this.logger.debug("Received batch of proposals", { count: proposals.length });

      proposals.forEach((proposal) => this.processInitialProposal(proposal));
    }
  }
}
