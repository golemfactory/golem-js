import { DemandBodyBuilder } from "../demand-body-builder";
import { IDemandDirector } from "../../market.module";
import { PaymentDemandDirectorConfig } from "./payment-demand-director-config";
import { Allocation } from "../../../payment";
import { IMarketApi } from "../../api";
export declare class PaymentDemandDirector implements IDemandDirector {
    private allocation;
    private marketApiAdapter;
    private config;
    constructor(allocation: Allocation, marketApiAdapter: IMarketApi, config?: PaymentDemandDirectorConfig);
    apply(builder: DemandBodyBuilder): Promise<void>;
}
