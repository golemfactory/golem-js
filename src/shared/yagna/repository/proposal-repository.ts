import { OfferProposal } from "../../../market/proposal/offer-proposal";
import { MarketApi, IdentityApi } from "ya-ts-client";
import { Demand, GolemMarketError, MarketErrorCode } from "../../../market";
import { CacheService } from "../../cache/CacheService";
import { IProposalRepository } from "../../../market/proposal/types";
import { MarketProposal } from "../../../market/proposal/market-proposal";
import { OfferCounterProposal } from "../../../market/proposal/offer-counter-proposal";

export class ProposalRepository implements IProposalRepository {
  constructor(
    private readonly marketService: MarketApi.RequestorService,
    private readonly identityService: IdentityApi.DefaultService,
    private readonly cache: CacheService<MarketProposal>,
  ) {}

  add(proposal: MarketProposal) {
    this.cache.set(proposal.id, proposal);
    return proposal;
  }

  getById(id: string) {
    return this.cache.get(id);
  }

  async getByDemandAndId(demand: Demand, id: string): Promise<MarketProposal> {
    try {
      const dto = await this.marketService.getProposalOffer(demand.id, id);
      const identity = await this.identityService.getIdentity();
      const isIssuedByRequestor = identity.identity === dto.issuerId ? "Requestor" : "Provider";

      return isIssuedByRequestor ? new OfferCounterProposal(dto) : new OfferProposal(dto, demand);
    } catch (error) {
      const message = error.message;
      throw new GolemMarketError(`Failed to get proposal: ${message}`, MarketErrorCode.CouldNotGetProposal, error);
    }
  }
}
