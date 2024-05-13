import { IProposalRepository, Proposal } from "../../../market/proposal";
import { MarketApi } from "ya-ts-client";
import { Demand } from "../../../market";
import { CacheService } from "../../cache/CacheService";

export class ProposalRepository implements IProposalRepository {
  constructor(
    private readonly api: MarketApi.RequestorService,
    private readonly cache: CacheService<Proposal>,
  ) {}

  add(proposal: Proposal) {
    this.cache.set(proposal.id, proposal);
    return proposal;
  }

  getById(id: string) {
    return this.cache.get(id);
  }

  async getByDemandAndId(demand: Demand, id: string): Promise<Proposal> {
    const dto = await this.api.getProposalOffer(demand.id, id);
    return new Proposal(dto, demand);
  }
}
