import { WorkloadDemandDirectorConfigOptions } from "../options";
import { BaseConfig } from "./base-config";
export declare enum PackageFormat {
    GVMKitSquash = "gvmkit-squash"
}
type RequiredWorkloadDemandConfigOptions = {
    /** Number of seconds after which the agreement resulting from this demand will no longer be valid */
    expirationSec: number;
};
export declare class WorkloadDemandDirectorConfig extends BaseConfig {
    readonly packageFormat: string;
    readonly engine: string;
    readonly runtime: {
        name: string;
        version: undefined;
    };
    readonly minMemGib: number;
    readonly minStorageGib: number;
    readonly minCpuThreads: number;
    readonly minCpuCores: number;
    readonly capabilities: string[];
    readonly expirationSec: number;
    readonly manifest?: string;
    readonly manifestSig?: string;
    readonly manifestSigAlgorithm?: string;
    readonly manifestCert?: string;
    readonly useHttps?: boolean;
    readonly imageHash?: string;
    readonly imageTag?: string;
    readonly imageUrl?: string;
    constructor(options: Partial<WorkloadDemandDirectorConfigOptions> & RequiredWorkloadDemandConfigOptions);
}
export {};
