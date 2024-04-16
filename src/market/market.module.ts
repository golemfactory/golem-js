/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Demand, Proposal, ProposalFilter } from "./index";
import { Agreement, AgreementOptions } from "../agreement";

import { YagnaApi, YagnaEventSubscription } from "../shared/utils";
import { ProposalPool } from "./pool";
import { PaymentModule } from "../payment";

export interface MarketEvents {}

export interface DemandBuildParams {
  demand: DemandOptions;
  market: MarketOptions;
}

export interface DemandOptions {
  image: string;
  resources?: Resources;
}

/**
 * -----*----*-----X----*-----X-----*
 *
 * const final = await sub.waitFor((p) => p.paretnId == 123);
 */
export interface Resources {
  /** The minimum CPU requirement for each service instance. */
  minCpu?: number;
  /* The minimum memory requirement (in Gibibyte) for each service instance. */
  minMemGib?: number;
  /** The minimum storage requirement (in Gibibyte) for each service instance. */
  minStorageGib?: number;
}

export interface MarketOptions {
  /** How long you want to rent the resources in hours */
  rentHours?: number;

  pricing?: {
    maxStartPrice: number;
    maxCpuPerHourPrice: number;
    maxEnvPerHourPrice: number;
  };

  /** The payment network that should be considered while looking for providers and where payments will be done */
  paymentNetwork?: string;

  /**
   * List of provider Golem Node IDs that should be considered
   *
   * If not provided, the list will be pulled from: https://provider-health.golem.network/v1/provider-whitelist
   */
  withProviders?: string[];
  withoutProviders?: string[];
  withOperators?: string[];
  withoutOperators?: string[];
}

export interface ProposalSubscription {
  cancel: () => void;
}

export interface MarketModule {
  events: EventEmitter<MarketEvents>;

  buildDemand(options: DemandBuildParams): Promise<Demand>;

  subscribeForProposals(demand: Demand): ProposalSubscription;

  /**
   *
   * Internally this starts countering the proposal from the provider up to the point
   * where both sides reach consensus that can be used to form an agreement.
   *
   * @return A proposal which is already fully negotiated and ready to from an Agreement from
   */
  negotiateProposal(
    proposalStream: YagnaEventSubscription<Proposal>,
    original: Proposal,
    counter?: Proposal,
  ): Promise<Proposal>;

  /**
   * Internally
   *
   * - ya-ts-client createAgreement
   * - ya-ts-client approveAgreement
   * - ya-ts-client "wait for approval"
   *
   * @param paymentModule
   * @param proposal
   * @param options
   *
   * @return Returns when the provider accepts the agreement, rejects otherwise. The resulting agreement is ready to create activities from.
   */
  proposeAgreement(paymentModule: PaymentModule, proposal: Proposal, options?: AgreementOptions): Promise<Agreement>;

  /**
   *
   * @return The Agreement that has been terminated via Yagna
   */
  terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement>;

  /**
   * Helper method that will allow reaching an agreement for the user without dealing with manual labour of demand/subscription
   */
  getAgreement(options: MarketOptions, filter: ProposalFilter): Promise<Agreement>;

  getAgreements(options: MarketOptions, filter: ProposalFilter, count: number): Promise<Agreement[]>;

  subscribeForDraftProposals(
    initialProposalSubscription: YagnaEventSubscription<Proposal>,
  ): Promise<YagnaEventSubscription<Proposal>>;

  startCollectingProposal(options: DemandBuildParams, pool: ProposalPool): Promise<ProposalSubscription>;
}

export class MarketModuleImpl implements MarketModule {
  events: EventEmitter<MarketEvents> = new EventEmitter<MarketEvents>();

  constructor(private readonly yagnaApi: YagnaApi) {}

  buildDemand(options: DemandBuildParams): Promise<Demand> {
    throw new Error("Method not implemented.");
  }

  subscribeForProposals(demand: Demand): ProposalSubscription {
    // const subId = await this.yagnaApi.market.subscribeDemand(demand);
    //
    // // Getting a 404 while collecting offers should cancel the subscription
    // const sub = Subscription.longPoll(() => this.yagnaApi.market.collectOffers(subId)).map(
    //   (proposalDto: ProposalDTO) => {
    //     const p = new Proposal(demand, null);
    //
    //     // More work...
    //
    //     return p;
    //   },
    // );
    //
    // // sub.cancel();
    // return sub;

    throw new Error("Method not implemented.");
  }

  negotiateProposal(
    proposalStream: YagnaEventSubscription<Proposal>,
    original: Proposal,
    counter: Proposal,
  ): Promise<Proposal> {
    throw new Error("Method not implemented.");
  }

  proposeAgreement(paymentModule: PaymentModule, proposal: Proposal, options?: AgreementOptions): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  terminateAgreement(agreement: Agreement, reason: string): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  getAgreement(options: MarketOptions, filter: ProposalFilter): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  getAgreements(options: MarketOptions, filter: ProposalFilter, count: number): Promise<Agreement[]> {
    throw new Error("Method not implemented.");
  }

  async startCollectingProposal(options: DemandBuildParams, pool: ProposalPool): Promise<ProposalSubscription> {
    const demand = await this.buildDemand(options);
    return this.subscribeForProposals(demand);
  }

  async subscribeForDraftProposals(
    initialProposalSubscription: YagnaEventSubscription<Proposal>,
  ): Promise<YagnaEventSubscription<Proposal>> {
    throw new Error("Method not implemented.");
  }
}
