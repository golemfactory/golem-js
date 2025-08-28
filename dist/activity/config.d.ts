import { ExecutionOptions } from "./exe-script-executor";
/**
 * @internal
 */
export declare class ExecutionConfig {
    readonly activityExeBatchResultPollIntervalSeconds: number;
    readonly activityExeBatchResultMaxRetries: number;
    constructor(options?: ExecutionOptions);
}
