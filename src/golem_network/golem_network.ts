import { TaskExecutor, YagnaOptions } from "../executor";
import { JobStorage } from "../job";
import { PackageOptions } from "../package";
import { Worker } from "../task";

export interface GolemNetworkConfig {
  image?: string;
  yagnaOptions?: YagnaOptions;
  demand?: Pick<PackageOptions, "minMemGib" | "minStorageGib" | "minCpuThreads" | "minCpuCores" | "capabilities">;
  enableLogging?: boolean;
  beforeEachJob?: Worker<unknown, unknown>;
  jobStorage?: JobStorage;
}
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
  private _executor: TaskExecutor | null = null;

  constructor(private readonly config: GolemNetworkConfig) {}

  private get executor() {
    if (this._executor === null) {
      throw new Error("GolemNetwork not initialized, please run init() first");
    }
    return this._executor;
  }

  public isInitialized() {
    return this._executor !== null;
  }

  public async init() {
    this._executor = await TaskExecutor.create({
      package: this.config.image ?? "golem/alpine:3.18.2",
      enableLogging: this.config.enableLogging ?? false,
      yagnaOptions: this.config.yagnaOptions,
      jobStorage: this.config.jobStorage,
      ...(this.config.demand ?? {}),
    });
    if (this.config.beforeEachJob) {
      this.executor.beforeEach(this.config.beforeEachJob);
    }
  }

  /**
   * Create a job on Golem Network.
   *
   * @description Create a job on Golem Network. You can use the job object to fetch the job status, results and errors. For more information see {@link Job}.
   * @param worker Worker function to run
   * @returns Job object
   * @example
   * ```typescript
   * const job = await network.createJob(async (ctx) => {
   * // do some work
   * return (await ctx.run("echo 'Hello from Golem'")).stdout;
   * });
   * console.log(job.id);
   * const status = await job.fetchState();
   * console.log(status);
   * ```
   */
  public async createJob<Output = unknown>(worker: Worker<unknown, Output>) {
    return this.executor.createJob(worker);
  }

  public getJobById(id: string) {
    return this.executor.getJobById(id);
  }

  /**
   * Run a task on Golem Network.
   *
   * @description The runTask method is the simplest way to run some code on Golem Network. Simply call `runTask` and await the promise to get your result.
   * @param worker Worker function to run
   * @returns Worker function result
   */
  public async runTask<Output = unknown>(worker: Worker<undefined, Output>) {
    return this.executor.run<Output>(worker);
  }

  public async close() {
    if (this._executor !== null) {
      await this._executor.end();
    }
  }
}
