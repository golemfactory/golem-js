import { MarketApi, IdentityApi } from "ya-ts-client";
import { Demand } from "../../../market";
import { CacheService } from "../../cache/CacheService";
import { IProposalRepository, MarketProposal } from "../../../market/proposal/market-proposal";
import { ExpirationManager } from "../../expiration/ExpirationManager";
export declare class ProposalRepository implements IProposalRepository {
    private readonly marketService;
    private readonly identityService;
    private readonly cache;
    private readonly expirationManager;
    constructor(marketService: MarketApi.RequestorService, identityService: IdentityApi.DefaultService, cache: CacheService<MarketProposal>, expirationManager: ExpirationManager);
    add(proposal: MarketProposal): MarketProposal;
    getById(id: string): MarketProposal | undefined;
    getByDemandAndId(demand: Demand, id: string): Promise<MarketProposal>;
}
