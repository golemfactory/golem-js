import { TaskExecutor } from "../executor/executor";
import { PackageOptions } from "../package";
import { Worker } from "../task";

// import for typedoc
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Job } from "../job";

export interface GolemNetworkConfig {
  image?: string;
  demand?: Pick<PackageOptions, "minMemGib" | "minStorageGib" | "minCpuThreads" | "minCpuCores" | "capabilities">;
  enableLogging?: boolean;
  beforeEachJob?: Worker<unknown, unknown>;
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
  private readonly image: string;
  private readonly enableLogging: boolean;
  private readonly beforeEachJob: Worker<unknown, unknown>;
  private readonly demand: GolemNetworkConfig["demand"];
  private _executor: TaskExecutor | null = null;

  constructor(config: GolemNetworkConfig = {}) {
    this.image = config.image || "golem/alpine:3.18.2";
    this.enableLogging = config.enableLogging || false;
    this.beforeEachJob = config.beforeEachJob || (async () => {});
    this.demand = config.demand || {};
  }

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
      package: this.image,
      enableLogging: this.enableLogging,
      ...this.demand,
    });
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
    return this.executor.createJob(async (ctx) => {
      await this.beforeEachJob(ctx);
      return worker(ctx);
    });
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
