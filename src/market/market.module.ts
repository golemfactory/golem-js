/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Demand, Proposal, ProposalFilter } from "./index";
import { Agreement } from "../agreement";

import { YagnaEventSubscription } from "../utils";

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
  negotiateProposal(original: Proposal, counter: Proposal): Promise<Proposal>;

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

  generateAgreements(options: BuildDemandParams, filter: ProposalFilter): AsyncGenerator<Agreement>;
}

export class MarketModuleImpl implements MarketModule {
  events: EventEmitter<MarketEvents> = new EventEmitter<MarketEvents>();

  buildDemand(_options: BuildDemandParams): Promise<Demand> {
    throw new Error("Method not implemented.");
  }

  subscribeForProposals(_demand: Demand): YagnaEventSubscription<Proposal> {
    throw new Error("Method not implemented.");
  }

  negotiateProposal(_original: Proposal, _counter: Proposal): Promise<Proposal> {
    throw new Error("Method not implemented.");
  }

  proposeAgreement(_proposal: Proposal): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  terminateAgreement(_agreement: Agreement, _reason: string): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  getAgreement(_options: BuildDemandParams, _filter: ProposalFilter): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  getAgreements(_options: BuildDemandParams, _filter: ProposalFilter, _count: number): Promise<Agreement[]> {
    throw new Error("Method not implemented.");
  }

  generateAgreements(_options: BuildDemandParams, _filter: ProposalFilter): AsyncGenerator<Agreement> {
    throw new Error("Method not implemented.");
  }
}
