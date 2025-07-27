import { MarketApi, IdentityApi } from "ya-ts-client";
import { Demand } from "../../../market";
import { CacheService } from "../../cache/CacheService";
import { IProposalRepository, MarketProposal } from "../../../market/proposal/market-proposal";
export declare class ProposalRepository implements IProposalRepository {
    private readonly marketService;
    private readonly identityService;
    private readonly cache;
    constructor(marketService: MarketApi.RequestorService, identityService: IdentityApi.DefaultService, cache: CacheService<MarketProposal>);
    add(proposal: MarketProposal): MarketProposal;
    getById(id: string): MarketProposal | undefined;
    getByDemandAndId(demand: Demand, id: string): Promise<MarketProposal>;
}
