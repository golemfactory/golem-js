import { ExeUnit } from "../../activity/exe-unit";
import { EventEmitter } from "eventemitter3";
import { GolemNetwork, MarketOrderSpec } from "../../golem-network/golem-network";
import { Logger } from "../../shared/utils";
export declare enum JobState {
    New = "new",
    Queued = "queued",
    Pending = "pending",
    Done = "done",
    Retry = "retry",
    Rejected = "rejected"
}
export type WorkFunction<OutputType> = (exe: ExeUnit) => Promise<OutputType>;
export interface JobEventsDict {
    /**
     * Emitted immediately after the job is created and initialization begins.
     */
    created: () => void;
    /**
     * Emitted when the job finishes initialization and work begins.
     */
    started: () => void;
    /**
     * Emitted when the job completes successfully and cleanup begins.
     */
    success: () => void;
    /**
     * Emitted when the job fails and cleanup begins.
     */
    error: (error: Error) => void;
    /**
     * Emitted when the job is canceled by the user.
     */
    canceled: () => void;
    /**
     * Emitted when the job finishes cleanup after success, error or cancelation.
     */
    ended: () => void;
}
/**
 * @experimental This API is experimental and subject to change. Use at your own risk.
 *
 * The Job class represents a single self-contained unit of work that can be run on the Golem Network.
 * It is responsible for managing the lifecycle of the work and providing information about its state.
 * It also provides an event emitter that can be used to listen for state changes.
 */
export declare class Job<Output = unknown> {
    readonly id: string;
    private readonly glm;
    private readonly order;
    private readonly logger;
    readonly events: EventEmitter<JobEventsDict>;
    private abortController;
    results: Output | undefined;
    error: Error | undefined;
    state: JobState;
    /**
     * @param id
     * @param glm
     * @param order
     * @param logger
     */
    constructor(id: string, glm: GolemNetwork, order: MarketOrderSpec, logger: Logger);
    isRunning(): boolean;
    /**
     * Run your worker function on the Golem Network. This method will synchronously initialize all internal services and validate the job options. The work itself will be run asynchronously in the background.
     * You can use the {@link experimental/job/job.Job.events} event emitter to listen for state changes.
     * You can also use {@link experimental/job/job.Job.waitForResult} to wait for the job to finish and get the results.
     * If you want to cancel the job, use {@link experimental/job/job.Job.cancel}.
     * If you want to run multiple jobs in parallel, you can use {@link experimental/job/job_manager.JobManager.createJob} to create multiple jobs and run them in parallel.
     *
     * @param workOnGolem - Your worker function that will be run on the Golem Network.
     */
    startWork(workOnGolem: WorkFunction<Output>): void;
    private runWork;
    /**
     * Cancel the job. This method will stop the activity and wait for it to finish.
     * Throws an error if the job is not running.
     */
    cancel(): Promise<void>;
    /**
     * Wait for the job to finish and return the results.
     * Throws an error if the job was not started.
     */
    waitForResult(): Promise<unknown>;
}
