import { v4 } from "uuid";
import { Job, RunJobOptions } from "./job";
import { YagnaApi, YagnaOptions } from "../../shared/utils";
import { GolemUserError } from "../../shared/error/golem-error";

export type JobManagerConfig = Partial<RunJobOptions> & { yagna?: YagnaOptions };

/**
 * @experimental This API is experimental and subject to change. Use at your own risk.
 *
 * The Golem Network class provides a high-level API for running jobs on the Golem Network.
 */
export class JobManager {
  private yagna: YagnaApi | null = null;

  private jobs = new Map<string, Job>();

  /**
   * @param config - Configuration options that will be passed to all jobs created by this instance.
   */
  constructor(private readonly config: JobManagerConfig) {}

  public isInitialized() {
    return this.yagna !== null;
  }

  public async init() {
    const yagna = new YagnaApi(this.config.yagna);
    await yagna.connect();
    this.yagna = yagna;
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
    const job = new Job<Output>(jobId, this.yagna!, { ...this.config, ...options });
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
    this.yagna = null;
  }

  private checkInitialization() {
    if (!this.isInitialized()) {
      throw new GolemUserError("GolemNetwork not initialized, please run init() first");
    }
  }
}
