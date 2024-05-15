import { IProposalRepository, OfferProposal } from "../../../market/offer-proposal";
import { MarketApi } from "ya-ts-client";
import { Demand } from "../../../market";
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
    const dto = await this.api.getProposalOffer(demand.id, id);
    return new OfferProposal(dto, demand);
  }
}
