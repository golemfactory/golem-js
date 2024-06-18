import { v4 } from "uuid";
import { Job, RunJobOptions } from "./job";
import { defaultLogger, Logger, YagnaOptions, isNode, isBrowser } from "../../shared/utils";
import { GolemUserError } from "../../shared/error/golem-error";
import { GolemNetwork, MarketOrderSpec } from "../../golem-network/golem-network";
import {
  GftpStorageProvider,
  NullStorageProvider,
  StorageProvider,
  WebSocketBrowserStorageProvider,
} from "../../shared/storage";

export type JobManagerConfig = Partial<RunJobOptions> & {
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
    private readonly config?: JobManagerConfig,
    private readonly logger: Logger = defaultLogger("jobs"),
  ) {
    const storageProvider = this.getDefaultStorageProvider();

    this.logger.debug("Jobs using storage provider", { storageProvider });

    this.glm = new GolemNetwork({
      api: {
        key: this.config?.yagna?.apiKey,
        url: this.config?.yagna?.basePath,
      },
      dataTransferProtocol: storageProvider,
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

  private getDefaultStorageProvider(): StorageProvider {
    if (isNode) {
      return new GftpStorageProvider();
    }

    if (isBrowser) {
      return new WebSocketBrowserStorageProvider(this.glm.services.yagna, {});
    }

    return new NullStorageProvider();
  }
}
