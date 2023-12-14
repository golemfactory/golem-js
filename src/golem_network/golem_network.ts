import { v4 } from "uuid";
import { YagnaOptions } from "../executor";
import { Job } from "../job";
import { Yagna } from "../utils";
import { RunJobOptions } from "../job/job";
import { GolemError } from "../error/golem-error";

/**
 * The Golem Network class provides a high-level API for running jobs on the Golem Network.
 */
export class GolemNetwork {
  private _yagna: Yagna | null = null;

  private jobs = new Map<string, Job>();

  /**
   * @param config - Configuration options that will be passed to all jobs created by this instance.
   */
  constructor(private readonly config: Partial<RunJobOptions> & { yagna?: YagnaOptions }) {}

  private get yagna() {
    if (this._yagna === null) {
      throw new GolemError("GolemNetwork not initialized, please run init() first");
    }
    return this._yagna;
  }

  public isInitialized() {
    return this._yagna !== null;
  }

  public async init() {
    if (this._yagna !== null) {
      return;
    }
    const yagna = new Yagna(this.config.yagna);
    // this will throw an error if yagna is not running
    await yagna.connect();
    this._yagna = yagna;
  }

  /**
   * Create a new job and add it to the list of jobs managed by this instance.
   * This method does not start any work on the network, use {@link Job.startWork} for that.
   *
   * @param options - Configuration options for the job. These options will be merged with the options passed to the constructor.
   */
  public createJob<Output = unknown>(options: RunJobOptions = {}) {
    const jobId = v4();
    const job = new Job<Output>(jobId, this.yagna.getApi(), { ...this.config, ...options });
    this.jobs.set(jobId, job);
    return job;
  }

  public getJobById(id: string) {
    return this.jobs.get(id);
  }

  /**
   * Close the connection to the Yagna service and cancel all running jobs.
   */
  public async close() {
    const pendingJobs = Array.from(this.jobs.values()).filter((job) => job.isRunning());
    await Promise.allSettled(pendingJobs.map((job) => job.cancel()));
    await this.yagna.end();
  }
}
