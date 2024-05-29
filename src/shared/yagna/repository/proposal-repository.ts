import { IProposalRepository, OfferProposal } from "../../../market/offer-proposal";
import { MarketApi, IdentityApi } from "ya-ts-client";
import { Demand, GolemMarketError, MarketErrorCode } from "../../../market";
import { CacheService } from "../../cache/CacheService";

export class ProposalRepository implements IProposalRepository {
  constructor(
    private readonly marketService: MarketApi.RequestorService,
    private readonly identityService: IdentityApi.DefaultService,
    private readonly cache: CacheService<OfferProposal>,
  ) {}

  add(proposal: OfferProposal) {
    this.cache.set(proposal.id, proposal);
    return proposal;
  }

  getById(id: string) {
    return this.cache.get(id);
  }

  async getByDemandAndId(demand: Demand, id: string): Promise<OfferProposal> {
    try {
      const dto = await this.marketService.getProposalOffer(demand.id, id);
      const identity = await this.identityService.getIdentity();
      const issuer = identity.identity === dto.issuerId ? "Requestor" : "Provider";

      return new OfferProposal(dto, issuer, demand);
    } catch (error) {
      const message = error.message;
      throw new GolemMarketError(`Failed to get proposal: ${message}`, MarketErrorCode.CouldNotGetProposal, error);
    }
  }
}
