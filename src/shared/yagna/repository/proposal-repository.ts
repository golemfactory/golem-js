import { IProposalRepository, OfferProposal } from "../../../market/offer-proposal";
import { MarketApi } from "ya-ts-client";
import { Demand, GolemMarketError, MarketErrorCode } from "../../../market";
import { CacheService } from "../../cache/CacheService";

export class ProposalRepository implements IProposalRepository {
  constructor(
    private readonly api: MarketApi.RequestorService,
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
      const dto = await this.api.getProposalOffer(demand.id, id);
      return new OfferProposal(dto, demand);
    } catch (error) {
      const message = error.message;
      throw new GolemMarketError(`Failed to get proposal: ${message}`, MarketErrorCode.CouldNotGetProposal, error);
    }
  }
}
