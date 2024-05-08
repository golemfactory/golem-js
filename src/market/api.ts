import { Observable } from "rxjs";
import { Demand, DemandSpecification } from "./demand";
import YaTsClient from "ya-ts-client";
import { ProposalNew } from "./proposal";

export type NewProposalEvent = YaTsClient.MarketApi.ProposalEventDTO;
export type ProposalRejectedEvent = YaTsClient.MarketApi.ProposalRejectedEventDTO;
export type ProposalEvent = NewProposalEvent | ProposalRejectedEvent;

export interface MarketApi {
  /**
   * Creates a new demand based on the given specification and publishes
   * it to the market.
   * Keep in mind that the demand lasts for a limited time and needs to be
   * refreshed periodically (see `refreshDemand` method).
   * Use `unpublishDemand` to remove the demand from the market.
   */
  publishDemandSpecification(specification: DemandSpecification): Promise<Demand>;

  /**
   * Remove the given demand from the market.
   */
  unpublishDemand(demand: Demand): Promise<void>;

  /**
   * Creates a new observable that emits proposal events related to the given demand.
   */
  observeProposalEvents(demand: Demand): Observable<ProposalEvent>;

  /**
   * Sends a counter-proposal to the given proposal. Returns the newly created counter-proposal.
   */
  counterProposal(receivedProposal: ProposalNew, specification: DemandSpecification): Promise<ProposalNew>;
}
