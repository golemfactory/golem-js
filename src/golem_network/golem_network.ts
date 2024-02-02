import { v4 } from "uuid";
import { YagnaOptions } from "../executor";
import { Job } from "../job";
import { Yagna, YagnaApi } from "../utils";
import { RunJobOptions } from "../job/job";
import { GolemUserError } from "../error/golem-error";

export type GolemNetworkConfig = Partial<RunJobOptions> & { yagna?: YagnaOptions };

/**
 * The Golem Network class provides a high-level API for running jobs on the Golem Network.
 */
export class GolemNetwork {
  private yagna: Yagna;
  private api: YagnaApi | null = null;

  private jobs = new Map<string, Job>();

  /**
   * @param config - Configuration options that will be passed to all jobs created by this instance.
   */
  constructor(private readonly config: GolemNetworkConfig) {
    this.yagna = new Yagna(this.config.yagna);
  }

  public isInitialized() {
    return this.api !== null;
  }

  public async init() {
    await this.yagna.connect();
    this.api = this.yagna.getApi();
  }

  /**
   * Create a new job and add it to the list of jobs managed by this instance.
   * This method does not start any work on the network, use {@link Job.startWork} for that.
   *
   * @param options - Configuration options for the job. These options will be merged with the options passed to the constructor.
   */
  public createJob<Output = unknown>(options: RunJobOptions = {}) {
    this.checkInitialization();

    const jobId = v4();
    const job = new Job<Output>(jobId, this.api!, { ...this.config, ...options });
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
    await this.yagna.end();
    this.api = null;
  }

  private checkInitialization() {
    if (!this.isInitialized()) {
      throw new GolemUserError("GolemNetwork not initialized, please run init() first");
    }
  }
}
