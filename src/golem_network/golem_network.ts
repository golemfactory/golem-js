import { v4 } from "uuid";
import { YagnaOptions } from "../executor";
import { Job } from "../job";
import { Yagna } from "../utils";
import { RunJobOptions } from "../job/job";

/**
 * The starting point for using Golem Network.
 *
 * @description The GolemNetwork class is the best way to get started with developing on Golem Network. It provides a simple interface for creating jobs and running tasks.
 * @example
 * ```typescript
 * import { GolemNetwork } from "@golem-sdk/golem-js";
 * const network = new GolemNetwork();
 * network.init().then(() => {
 *  // network is ready to use
 *  const result = await network.runTask(async (ctx) => {
 *   // do some work
 *   return (await ctx.run("echo 'Hello from Golem'")).stdout;
 *  });
 *  console.log(result);
 * });
 *```
 */
export class GolemNetwork {
  private _yagna: Yagna | null = null;

  private jobs = new Map<string, Job<unknown>>();

  constructor(private readonly config: Partial<RunJobOptions> & { yagna?: YagnaOptions }) {}

  private get yagna() {
    if (this._yagna === null) {
      throw new Error("GolemNetwork not initialized, please run init() first");
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
    // make sure it's possible to connect to the yagna service
    // this will throw an error if yagna is not running
    await yagna.getApi().identity.getIdentity();
    this._yagna = yagna;
  }

  public async createJob<Output = unknown>() {
    const jobId = v4();
    const job = new Job<Output>(jobId, this.yagna.getApi());
    this.jobs.set(jobId, job);
    return job;
  }

  public getJobById(id: string) {
    return this.jobs.get(id);
  }

  public async close() {
    const pendingJobs = Array.from(this.jobs.values()).filter((job) => job.isRunning);
    await Promise.all(pendingJobs.map((job) => job.cancel()));
    await this.yagna.end();
  }
}
