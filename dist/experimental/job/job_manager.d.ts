import { Job } from "./job";
import { Logger, YagnaOptions } from "../../shared/utils";
import { GolemNetworkOptions, MarketOrderSpec } from "../../golem-network/golem-network";
export type JobManagerConfig = Partial<GolemNetworkOptions> & {
    /**
     * @deprecated This field is deprecated and will be removed in future versions. Please use the 'api.key` and `api.url' instead.
     */
    yagna?: YagnaOptions;
};
/**
 * @experimental This API is experimental and subject to change. Use at your own risk.
 *
 * The Golem Network class provides a high-level API for running jobs on the Golem Network.
 */
export declare class JobManager {
    private readonly logger;
    private glm;
    private jobs;
    /**
     * @param config - Configuration options that will be passed to all jobs created by this instance.
     * @param logger
     */
    constructor(config?: JobManagerConfig, logger?: Logger);
    isInitialized(): boolean;
    init(): Promise<void>;
    /**
     * Create a new job and add it to the list of jobs managed by this instance.
     * This method does not start any work on the network, use {@link experimental/job/job.Job.startWork} for that.
     *
     * @param order
     */
    createJob<Output = unknown>(order: MarketOrderSpec): Job<Output>;
    getJobById(id: string): Job<unknown> | undefined;
    /**
     * Close the connection to the Yagna service and cancel all running jobs.
     */
    close(): Promise<void>;
    private checkInitialization;
}
