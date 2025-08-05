import { MarketProposal } from "./market-proposal";
import { MarketApi } from "ya-ts-client";
export declare class OfferCounterProposal extends MarketProposal {
    readonly issuer = "Requestor";
    constructor(model: MarketApi.ProposalDTO);
    protected validate(): void;
}
