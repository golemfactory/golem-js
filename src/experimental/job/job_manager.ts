import { v4 } from "uuid";
import { Job } from "./job";
import { defaultLogger, Logger, YagnaOptions } from "../../shared/utils";
import { GolemUserError } from "../../shared/error/golem-error";
import { GolemNetwork, GolemNetworkOptions, MarketOrderSpec } from "../../golem-network/golem-network";

export type JobManagerConfig = Partial<GolemNetworkOptions> & {
  /** Type of engine required: vm, wasm, vm-nvidia, etc...
   * @deprecated This field is deprecated and will be removed in future versions. Please use the 'api.key` and `api.url' instead.
   */
  yagna?: YagnaOptions;
};

/**
 * @experimental This API is experimental and subject to change. Use at your own risk.
 *
 * The Golem Network class provides a high-level API for running jobs on the Golem Network.
 */
export class JobManager {
  private glm: GolemNetwork;
  private jobs = new Map<string, Job>();

  /**
   * @param config - Configuration options that will be passed to all jobs created by this instance.
   * @param logger
   */
  constructor(
    config?: JobManagerConfig,
    private readonly logger: Logger = defaultLogger("jobs"),
  ) {
    this.glm = new GolemNetwork({
      api: {
        key: config?.yagna?.apiKey,
        url: config?.yagna?.basePath,
      },
      logger: this.logger,
      ...config,
    });
  }

  public isInitialized() {
    return this.glm.isConnected();
  }

  public async init() {
    await this.glm.connect();
  }

  /**
   * Create a new job and add it to the list of jobs managed by this instance.
   * This method does not start any work on the network, use {@link experimental/job/job.Job.startWork} for that.
   *
   * @param order
   */
  public createJob<Output = unknown>(order: MarketOrderSpec) {
    this.checkInitialization();

    const jobId = v4();
    const job = new Job<Output>(jobId, this.glm, order, this.logger);
    this.jobs.set(jobId, job);

    return job;
  }

  public getJobById(id: string) {
    this.checkInitialization();

    return this.jobs.get(id);
  }

  /**
   * Close the connection to the Yagna service and cancel all running jobs.
   */
  public async close() {
    const pendingJobs = Array.from(this.jobs.values()).filter((job) => job.isRunning());
    await Promise.allSettled(pendingJobs.map((job) => job.cancel()));
    await this.glm.disconnect();
  }

  private checkInitialization() {
    if (!this.isInitialized()) {
      throw new GolemUserError("GolemNetwork not initialized, please run init() first");
    }
  }
}
