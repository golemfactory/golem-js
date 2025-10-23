import { WorkloadDemandDirectorConfig } from "./workload-demand-director-config";
import { DemandBodyBuilder } from "../demand-body-builder";
import { IDemandDirector } from "../../market.module";
export declare class WorkloadDemandDirector implements IDemandDirector {
    private config;
    constructor(config: WorkloadDemandDirectorConfig);
    apply(builder: DemandBodyBuilder): Promise<void>;
    private resolveTaskPackageFromCustomUrl;
    private resolveTaskPackageUrl;
    private addManifestDecorations;
}
