import { Agreement, IAgreementRepository } from "../../../market/agreement/agreement";
import { MarketApi } from "ya-ts-client";
import { IDemandRepository } from "../../../market/demand/demand";
export declare class AgreementRepository implements IAgreementRepository {
    private readonly api;
    private readonly demandRepo;
    constructor(api: MarketApi.RequestorService, demandRepo: IDemandRepository);
    getById(id: string): Promise<Agreement>;
}
