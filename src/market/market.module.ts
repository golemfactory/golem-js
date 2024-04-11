/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Demand, Proposal, ProposalFilter } from "./index";
import { Agreement } from "../agreement";

import { YagnaApi, YagnaEventSubscription } from "../shared/utils";
import { ProposalPool, ProposalSelector } from "./pool";

export interface MarketEvents {}

/**
 * -----*----*-----X----*-----X-----*
 *
 * const final = await sub.waitFor((p) => p.paretnId == 123);
 */
export type BuildDemandParams = { paymentNetwork: string };

export interface MarketModule {
  events: EventEmitter<MarketEvents>;

  buildDemand(options: BuildDemandParams): Promise<Demand>;

  subscribeForProposals(demand: Demand): YagnaEventSubscription<Proposal>;

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
   * @param proposal
   *
   * @return Returns when the provider accepts the agreement, rejects otherwise. The resulting agreement is ready to create activities from.
   */
  proposeAgreement(proposal: Proposal): Promise<Agreement>;

  /**
   *
   * @return The Agreement that has been terminated via Yagna
   */
  terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement>;

  /**
   * Helper method that will allow reaching an agreement for the user without dealing with manual labour of demand/subscription
   */
  getAgreement(options: BuildDemandParams, filter: ProposalFilter): Promise<Agreement>;

  getAgreements(options: BuildDemandParams, filter: ProposalFilter, count: number): Promise<Agreement[]>;

  subscribeForDraftProposals(
    initialProposalSubscription: YagnaEventSubscription<Proposal>,
  ): Promise<YagnaEventSubscription<Proposal>>;

  startCollectingProposal(options: {
    demandParams: BuildDemandParams;
    filter?: ProposalFilter;
    selector?: ProposalSelector;
  }): Promise<{ pool: ProposalPool; cancel: () => void }>;
}

export class MarketModuleImpl implements MarketModule {
  events: EventEmitter<MarketEvents> = new EventEmitter<MarketEvents>();

  constructor(private readonly yagnaApi: YagnaApi) {}

  buildDemand(options: BuildDemandParams): Promise<Demand> {
    throw new Error("Method not implemented.");
  }

  subscribeForProposals(demand: Demand): YagnaEventSubscription<Proposal> {
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

  proposeAgreement(proposal: Proposal): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  terminateAgreement(agreement: Agreement, reason: string): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  getAgreement(options: BuildDemandParams, filter: ProposalFilter): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  getAgreements(options: BuildDemandParams, filter: ProposalFilter, count: number): Promise<Agreement[]> {
    throw new Error("Method not implemented.");
  }

  async startCollectingProposal(options: {
    demandParams: BuildDemandParams;
    filter?: ProposalFilter;
    selector?: ProposalSelector;
  }): Promise<{
    pool: ProposalPool;
    cancel: () => void;
  }> {
    const pool = new ProposalPool({ selector: options.selector });
    const demand = await this.buildDemand(options.demandParams);
    const initialProposalSubscription = this.subscribeForProposals(demand);
    const subscription = await this.subscribeForDraftProposals(
      options.filter ? initialProposalSubscription.filter(options.filter) : initialProposalSubscription,
    );
    subscription.batch((draftProposals) => draftProposals.forEach((draft) => pool.add(draft)), {
      timeout: 1_000,
    });
    const cancel = () => {
      subscription.cancel();
      initialProposalSubscription.cancel();
      demand.unsubscribe();
    };
    return {
      pool,
      cancel,
    };
  }

  async subscribeForDraftProposals(
    initialProposalSubscription: YagnaEventSubscription<Proposal>,
  ): Promise<YagnaEventSubscription<Proposal>> {
    throw new Error("Method not implemented.");
  }
}
