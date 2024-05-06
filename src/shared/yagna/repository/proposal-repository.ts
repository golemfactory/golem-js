import { IProposalRepository, ProposalNew } from "../../../market/proposal";
import { MarketApi } from "ya-ts-client";
import { DemandNew } from "../../../market";
import { CacheService } from "../../cache/CacheService";

export class ProposalRepository implements IProposalRepository {
  constructor(
    private readonly api: MarketApi.RequestorService,
    private readonly cache: CacheService<ProposalNew>,
  ) {}

  add(proposal: ProposalNew) {
    this.cache.set(proposal.id, proposal);
    return proposal;
  }

  getById(id: string) {
    return this.cache.get(id);
  }

  async getByDemandAndId(demand: DemandNew, id: string): Promise<ProposalNew> {
    const dto = await this.api.getProposalOffer(demand.id, id);
    return new ProposalNew(dto, demand);
  }
}
