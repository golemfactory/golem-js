import { Logger } from "../shared/utils";
import { Result } from "./results";
import { Activity } from "./activity";
import { ActivityModule } from "./activity.module";
import { Observable } from "rxjs";
/**
 * Information needed to fetch the results of a script execution
 */
export interface ScriptExecutionMetadata {
    batchId: string;
    batchSize: number;
}
export interface ExeScriptRequest {
    text: string;
}
export interface ExecutionOptions {
    /** interval for fetching batch results while polling */
    activityExeBatchResultPollIntervalSeconds?: number;
    /** maximum number of retries retrieving results when an error occurs, default: 10 */
    activityExeBatchResultMaxRetries?: number;
    /** The timeout in milliseconds or an AbortSignal that will be used to cancel the execution */
    signalOrTimeout?: number | AbortSignal;
}
export declare class ExeScriptExecutor {
    readonly activity: Activity;
    private readonly activityModule;
    private readonly logger;
    private readonly options;
    private readonly abortSignal;
    constructor(activity: Activity, activityModule: ActivityModule, logger: Logger, options?: ExecutionOptions);
    /**
     * Executes the provided script and returns the batch id and batch size that can be used
     * to fetch it's results
     * @param script
     * @returns script execution metadata - batch id and batch size that can be used to fetch results using `getResultsObservable`
     */
    execute(script: ExeScriptRequest): Promise<ScriptExecutionMetadata>;
    /**
     * Given a batch id and batch size collect the results from yagna. You can choose to either
     * stream them as they go or poll for them. When a timeout is reached (by either the timeout provided
     * as an argument here or in the constructor) the observable will emit an error.
     *
     *
     * @param batch - batch id and batch size
     * @param stream - define type of getting results from execution (polling or streaming)
     * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the execution
     * @param maxRetries - maximum number of retries retrieving results when an error occurs, default: 10
     */
    getResultsObservable(batch: ScriptExecutionMetadata, stream?: boolean, signalOrTimeout?: number | AbortSignal, maxRetries?: number): Observable<Result>;
    protected send(script: ExeScriptRequest): Promise<string>;
    private pollingBatch;
    private streamingBatch;
    private parseEventToResult;
}
