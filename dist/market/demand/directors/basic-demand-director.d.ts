import { DemandBodyBuilder } from "../demand-body-builder";
import { IDemandDirector } from "../../market.module";
import { BasicDemandDirectorConfig } from "./basic-demand-director-config";
export declare class BasicDemandDirector implements IDemandDirector {
    private config;
    constructor(config?: BasicDemandDirectorConfig);
    apply(builder: DemandBodyBuilder): void;
}
