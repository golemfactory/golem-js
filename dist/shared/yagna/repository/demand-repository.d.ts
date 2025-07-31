import { Demand, IDemandRepository } from "../../../market/demand/demand";
import { MarketApi } from "ya-ts-client";
import { CacheService } from "../../cache/CacheService";
export declare class DemandRepository implements IDemandRepository {
    private readonly api;
    private readonly cache;
    constructor(api: MarketApi.RequestorService, cache: CacheService<Demand>);
    getById(id: string): Demand | undefined;
    add(demand: Demand): Demand;
    getAll(): Demand[];
}
