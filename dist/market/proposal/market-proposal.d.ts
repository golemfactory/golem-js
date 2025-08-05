import { ProposalProperties } from "./proposal-properties";
import { MarketApi } from "ya-ts-client";
import { ProposalState } from "./offer-proposal";
import { Demand } from "../demand";
export interface IProposalRepository {
    add(proposal: MarketProposal): MarketProposal;
    getById(id: string): MarketProposal | undefined;
    getByDemandAndId(demand: Demand, id: string): Promise<MarketProposal>;
}
/**
 * Base representation of a market proposal that can be issued either by the Provider (offer proposal)
 *   or Requestor (counter-proposal)
 */
export declare abstract class MarketProposal {
    protected readonly model: MarketApi.ProposalDTO;
    readonly id: string;
    /**
     * Reference to the previous proposal in the "negotiation chain"
     *
     * If null, this means that was the initial offer that the negotiations started from
     */
    readonly previousProposalId: string | null;
    abstract readonly issuer: "Provider" | "Requestor";
    readonly properties: ProposalProperties;
    protected constructor(model: MarketApi.ProposalDTO);
    get state(): ProposalState;
    get timestamp(): Date;
    isInitial(): boolean;
    isDraft(): boolean;
    isExpired(): boolean;
    isRejected(): boolean;
    isValid(): boolean;
    protected abstract validate(): void | never;
}
