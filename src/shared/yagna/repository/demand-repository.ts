import { DemandNew, IDemandRepository } from "../../../market/demand";
import { MarketApi } from "ya-ts-client";
import { CacheService } from "../../cache/CacheService";

export class DemandRepository implements IDemandRepository {
  constructor(
    private readonly api: MarketApi.RequestorService,
    private readonly cache: CacheService<DemandNew>,
  ) {}

  getById(id: string): DemandNew | undefined {
    return this.cache.get(id);
  }

  add(demand: DemandNew): DemandNew {
    this.cache.set(demand.id, demand);
    return demand;
  }

  getAll(): DemandNew[] {
    return this.cache.getAll();
  }
}
