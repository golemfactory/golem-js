import { Agreement, ProviderInfo } from "../market/agreement";
export declare enum ActivityStateEnum {
    New = "New",
    Initialized = "Initialized",
    Deployed = "Deployed",
    Ready = "Ready",
    Unresponsive = "Unresponsive",
    Terminated = "Terminated",
    /** In case when we couldn't establish the in on yagna */
    Unknown = "Unknown"
}
export type ActivityUsageInfo = {
    currentUsage?: number[];
    timestamp: number;
};
export interface IActivityRepository {
    getById(id: string): Promise<Activity>;
    getStateOfActivity(id: string): Promise<ActivityStateEnum>;
}
/**
 * Activity module - an object representing the runtime environment on the provider in accordance with the `Package` specification.
 * As part of a given activity, it is possible to execute exe script commands and capture their results.
 */
export declare class Activity {
    readonly id: string;
    readonly agreement: Agreement;
    protected readonly currentState: ActivityStateEnum;
    protected readonly previousState: ActivityStateEnum;
    protected readonly usage: ActivityUsageInfo;
    /**
     * @param id The ID of the activity in Yagna
     * @param agreement The agreement that's related to this activity
     * @param currentState The current state as it was obtained from yagna
     * @param previousState The previous state (or New if this is the first time we're creating the activity)
     * @param usage Current resource usage vector information
     */
    constructor(id: string, agreement: Agreement, currentState: ActivityStateEnum, previousState: ActivityStateEnum, usage: ActivityUsageInfo);
    get provider(): ProviderInfo;
    getState(): ActivityStateEnum;
    getPreviousState(): ActivityStateEnum;
}
