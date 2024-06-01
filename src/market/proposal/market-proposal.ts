import { ProposalProperties } from "./proposal-properties";
import { MarketApi } from "ya-ts-client";
import { ProposalState } from "./offer-proposal";

/**
 * Base representation of a market proposal that can be issued either by the Provider (offer proposal)
 *   or Requestor (counter-proposal)
 */
export abstract class MarketProposal {
  public readonly id: string;
  /**
   * Reference to the previous proposal in the "negotiation chain"
   *
   * If null, this means that was the initial offer that the negotiations started from
   */
  public readonly previousProposalId: string | null = null;

  public abstract readonly issuer: "Provider" | "Requestor";

  public readonly properties: ProposalProperties;

  protected constructor(protected readonly model: MarketApi.ProposalDTO) {
    this.id = model.proposalId;
    this.previousProposalId = model.prevProposalId ?? null;
    this.properties = model.properties as ProposalProperties;
  }

  public get state(): ProposalState {
    return this.model.state;
  }

  public get timestamp(): Date {
    return new Date(Date.parse(this.model.timestamp));
  }

  isInitial(): boolean {
    return this.model.state === "Initial";
  }

  isDraft(): boolean {
    return this.model.state === "Draft";
  }

  isExpired(): boolean {
    return this.model.state === "Expired";
  }

  isRejected(): boolean {
    return this.model.state === "Rejected";
  }

  public isValid(): boolean {
    try {
      this.validate();
      return true;
    } catch (err) {
      return false;
    }
  }

  protected abstract validate(): void | never;
}
