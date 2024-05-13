import { Demand, IDemandRepository } from "../../../market/demand";
import { MarketApi } from "ya-ts-client";
import { CacheService } from "../../cache/CacheService";

export class DemandRepository implements IDemandRepository {
  constructor(
    private readonly api: MarketApi.RequestorService,
    private readonly cache: CacheService<Demand>,
  ) {}

  getById(id: string): Demand | undefined {
    return this.cache.get(id);
  }

  add(demand: Demand): Demand {
    this.cache.set(demand.id, demand);
    return demand;
  }

  getAll(): Demand[] {
    return this.cache.getAll();
  }
}
