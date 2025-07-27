import { EventEmitter } from "eventemitter3";
import { Agreement } from "../market";
import { Activity, ActivityEvents, Result } from "./index";
import { GolemServices } from "../golem-network";
import { ExeUnit, ExeUnitOptions } from "./exe-unit";
import { ExecutionOptions, ExeScriptExecutor, ExeScriptRequest } from "./exe-script-executor";
import { Observable } from "rxjs";
import { StreamingBatchEvent } from "./results";
export interface ActivityModule {
    events: EventEmitter<ActivityEvents>;
    /**
     * Create and start a new activity on the provider for the supplied agreement
     *
     * @return The resulting activity on the provider for further use
     */
    createActivity(agreement: Agreement): Promise<Activity>;
    /**
     * Definitely terminate any work on the provider
     *
     * @return The activity that was permanently terminated
     */
    destroyActivity(activity: Activity): Promise<Activity>;
    /**
     * Fetches the latest state of the activity. It's recommended to use this method
     * before performing any actions on the activity to make sure it's in the correct state.
     * If the fetched activity's state is different from the one you have, an event will be emitted.
     */
    refreshActivity(staleActivity: Activity): Promise<Activity>;
    /**
     * Fetches the activity by its ID from yagna. If the activity doesn't exist, an error will be thrown.
     */
    findActivityById(activityId: string): Promise<Activity>;
    /**
     * Create a exe-unit "within" the activity so that you can perform commands on the rented resources
     *
     * @return An ExeUnit that's fully commissioned and the user can execute their commands
     */
    createExeUnit(activity: Activity, options?: ExeUnitOptions): Promise<ExeUnit>;
    /**
     * Factory method for creating a script executor for the activity
     */
    createScriptExecutor(activity: Activity, options?: ExecutionOptions): ExeScriptExecutor;
    /**
     * Execute a script on the activity.
     */
    executeScript(activity: Activity, script: ExeScriptRequest): Promise<string>;
    /**
     * Fetch the results of a batch execution.
     */
    getBatchResults(activity: Activity, batchId: string, commandIndex?: number, timeout?: number): Promise<Result[]>;
    /**
     * Create an observable that will emit events from the streaming batch.
     */
    observeStreamingBatchEvents(activity: Activity, batchId: string, commandIndex?: number): Observable<StreamingBatchEvent>;
}
/**
 * Information about a file that has been published via the FileServer
 */
export type FileServerEntry = {
    /** The URL of the file, that the clients can use to reach and download the file */
    fileUrl: string;
    /** The checksum that can be used by clients to validate integrity of the downloaded file */
    fileHash: string;
};
/**
 * An abstract interface describing a File Server that can be used to expose files from the Requestor to the Golem Network
 */
export interface IFileServer {
    /**
     * Exposes a file that can be accessed via Golem Network and GFTP
     */
    publishFile(sourcePath: string): Promise<FileServerEntry>;
    /**
     * Tells if the file was already published on the server
     */
    isFilePublished(sourcePath: string): boolean;
    /**
     * Returns publishing information for a file that has been already served
     */
    getPublishInfo(sourcePath: string): FileServerEntry | undefined;
    /**
     * Tells if the server is currently serving any files
     */
    isServing(): boolean;
}
export declare class ActivityModuleImpl implements ActivityModule {
    private readonly services;
    readonly events: EventEmitter<ActivityEvents>;
    private readonly logger;
    private readonly activityApi;
    constructor(services: GolemServices);
    createScriptExecutor(activity: Activity, options?: ExecutionOptions): ExeScriptExecutor;
    executeScript(activity: Activity, script: ExeScriptRequest): Promise<string>;
    getBatchResults(activity: Activity, batchId: string, commandIndex?: number | undefined, timeout?: number | undefined): Promise<Result[]>;
    observeStreamingBatchEvents(activity: Activity, batchId: string, commandIndex?: number | undefined): Observable<StreamingBatchEvent>;
    createActivity(agreement: Agreement): Promise<Activity>;
    destroyActivity(activity: Activity): Promise<Activity>;
    refreshActivity(staleActivity: Activity): Promise<Activity>;
    findActivityById(activityId: string): Promise<Activity>;
    createExeUnit(activity: Activity, options?: ExeUnitOptions): Promise<ExeUnit>;
}
