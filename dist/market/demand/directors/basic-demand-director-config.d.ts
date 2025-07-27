import { BaseConfig } from "./base-config";
export interface BasicDemandDirectorConfigOptions {
    /** Determines which subnet tag should be used for the offer/demand matching */
    subnetTag: string;
}
export declare class BasicDemandDirectorConfig extends BaseConfig implements BasicDemandDirectorConfigOptions {
    readonly subnetTag: string;
    constructor(options?: Partial<BasicDemandDirectorConfigOptions>);
}
