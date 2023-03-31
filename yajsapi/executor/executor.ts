import { Package, PackageOptions } from "../package/index.js";
import { DemandOptions, MarketService } from "../market/index.js";
import { AgreementOptions, AgreementPoolService } from "../agreement/index.js";
import { Task, TaskQueue, TaskService, Worker } from "../task/index.js";
import { PaymentService } from "../payment/index.js";
import { NetworkService } from "../network/index.js";
import { ActivityOptions, Result } from "../activity/index.js";
import { sleep, Logger, runtimeContextChecker } from "../utils/index.js";
import { StorageProvider, GftpStorageProvider } from "../storage/index.js";
import { ExecutorConfig } from "./config.js";
import { Events } from "../events/index.js";
import { StatsService } from "../stats/service.js";
import { TaskOptions } from "../task/service.js";
import { BasePaymentOptions } from "../payment/config.js";
import { NetworkServiceOptions } from "../network/service.js";
import { AgreementServiceOptions } from "../agreement/service.js";
import { WorkOptions } from "../task/work.js";
import { LogLevel } from "../utils/logger.js";
const terminatingSignals = ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"];

/**
 * @category High-level
 */
export type ExecutorOptions = {
  /** Image hash as string, otherwise Package object */
  package: string | Package;
  /** Timeout for execute one task in ms */
  taskTimeout?: number;
  /** Subnet Tag */
  subnetTag?: string;
  /** Logger module */
  logger?: Logger;
  /** Log level: debug, info, warn, log, error */
  logLevel?: LogLevel | string;
  /** Yagna Options */
  yagnaOptions?: YagnaOptions;
  /** Event Bus implements EventTarget  */
  eventTarget?: EventTarget;
  /** The maximum number of retries when the job failed on the provider */
  maxTaskRetries?: number;

  storageProvider?: StorageProvider;

  isSubprocess?: boolean;
} & ActivityOptions &
  AgreementOptions &
  BasePaymentOptions &
  DemandOptions &
  Omit<PackageOptions, "imageHash"> &
  TaskOptions &
  NetworkServiceOptions &
  AgreementServiceOptions &
  Omit<WorkOptions, "isRunning">;

/**
 * Contains information needed to start executor, if string the imageHash is required, otherwise it should be a type of {@link ExecutorOptions}
 * @category High-level
 */
export type ExecutorOptionsMixin = string | ExecutorOptions;

/**
 * @category High-level
 */
export type YagnaOptions = {
  apiKey: string;
  basePath: string;
};

/**
 * A high-level module for defining and executing tasks in the golem network
 * @category High-level
 */
export class TaskExecutor {
  private readonly options: ExecutorConfig;
  private marketService: MarketService;
  private agreementPoolService: AgreementPoolService;
  private taskService: TaskService;
  private paymentService: PaymentService;
  private networkService?: NetworkService;
  private statsService: StatsService;
  private initWorker?: Worker<unknown, unknown>;
  private taskQueue: TaskQueue<Task<any, any>>;
  private storageProvider?: StorageProvider;
  private logger?: Logger;
  private lastTaskIndex = 0;
  private isRunning = true;
  private configOptions: ExecutorOptions;

  /**
   * Create a new Task Executor
   * @category High-level
   * @description Factory Method that create and initialize an instance of the TaskExecutor
   *
   * @example **Simple usage of Task Executor**
   *
   * The executor can be created by passing appropriate initial parameters such as package, budget, subnet tag, payment driver, payment network etc.
   * One required parameter is a package. This can be done in two ways. First by passing only package image hash, e.g.
   * ```js
   * const executor = await TaskExecutor.create("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
   * ```
   *
   * @example **Usage of Task Executor with custom parameters**
   *
   * Or by passing some optional parameters, e.g.
   * ```js
   * const executor = await TaskExecutor.create({
   *   subnetTag: "public",
   *   payment: { driver: "erc-20", network: "rinkeby" },
   *   package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
   * });
   * ```
   *
   * @param options Task executor options
   * @return TaskExecutor
   */
  static async create(options: ExecutorOptionsMixin) {
    const executor = new TaskExecutor(options);
    await executor.init();
    return executor;
  }

  /**
   * Create a new TaskExecutor object.
   * @description Use {@link TaskExecutor.create} for creating a task executor
   *
   * @param options - contains information needed to start executor, if string the imageHash is required, otherwise it should be a type of {@link ExecutorOptions}
   */
  private constructor(options: ExecutorOptionsMixin) {
    this.configOptions = (typeof options === "string" ? { package: options } : options) as ExecutorOptions;
    this.options = new ExecutorConfig(this.configOptions);
    this.logger = this.options.logger;
    this.taskQueue = new TaskQueue<Task<any, any>>();
    this.agreementPoolService = new AgreementPoolService(this.options);
    this.paymentService = new PaymentService(this.options);
    this.marketService = new MarketService(this.agreementPoolService, this.options);
    this.networkService = this.options.networkIp ? new NetworkService(this.options) : undefined;
    this.storageProvider = runtimeContextChecker.isNode
      ? this.configOptions.storageProvider || new GftpStorageProvider(this.logger)
      : undefined;
    this.taskService = new TaskService(
      this.taskQueue,
      this.agreementPoolService,
      this.paymentService,
      this.networkService,
      { ...this.options, storageProvider: this.storageProvider }
    );
    this.statsService = new StatsService(this.options);
  }

  /**
   * Initialize executor
   *
   * @description Method responsible initialize all executor services.
   */
  async init() {
    const taskPackage =
      typeof this.options.package === "string" ? await this.createPackage(this.options.package) : this.options.package;
    this.logger?.debug("Initializing task executor services...");
    const allocations = await this.paymentService.createAllocations();
    this.marketService.run(taskPackage, allocations).catch((e) => this.handleCriticalError(e));
    this.agreementPoolService.run().catch((e) => this.handleCriticalError(e));
    this.paymentService.run().catch((e) => this.handleCriticalError(e));
    this.taskService.run().catch((e) => this.handleCriticalError(e));
    this.networkService?.run().catch((e) => this.handleCriticalError(e));
    this.statsService.run().catch((e) => this.handleCriticalError(e));
    this.storageProvider?.init().catch((e) => this.handleCriticalError(e));
    if (runtimeContextChecker.isNode && !this.options.isSubprocess) this.handleCancelEvent();
    this.options.eventTarget.dispatchEvent(new Events.ComputationStarted());
    this.logger?.info(
      `Task Executor has started using subnet: ${this.options.subnetTag}, network: ${this.options.payment?.network}, driver: ${this.options.payment?.driver}`
    );
  }

  /**
   * Stop all executor services and shut down executor instance
   */
  async end() {
    this.removeCancelEvent();
    if (!this.isRunning) return;
    this.isRunning = false;
    await this.networkService?.end();
    await this.taskService.end();
    await this.agreementPoolService.end();
    await this.marketService.end();
    await this.paymentService.end();
    if (!this.configOptions.storageProvider) this.storageProvider?.close();
    this.options.eventTarget?.dispatchEvent(new Events.ComputationFinished());
    this.printStats();
    await this.statsService.end();
    this.logger?.info("Task Executor has shut down");
  }

  /**
   * Statistics of execution process
   *
   * @return array
   */
  getStats() {
    return this.statsService.getStatsTree();
  }

  /**
   * Define worker function that will be runs before every each computation Task, within the same activity.
   *
   * @param worker worker function - task
   * @example
   * ```typescript
   * executor.beforeEach(async (ctx) => {
   *   await ctx.uploadFile("./params.txt", "/params.txt");
   * });
   *
   * await executor.forEach([1, 2, 3, 4, 5], async (ctx, item) => {
   *    await ctx
   *      .beginBatch()
   *      .run(`/run_some_command.sh --input ${item} --params /input_params.txt --output /output.txt`)
   *      .downloadFile("/output.txt", "./output.txt")
   *      .end();
   * });
   * ```
   */
  beforeEach(worker: Worker) {
    this.initWorker = worker;
  }

  /**
   * Run task - allows to execute a single worker function on the Golem network with a single provider.
   *
   * @param worker function that run task
   * @return result of task computation
   * @example
   * ```typescript
   * await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
   * ```
   */
  async run<OutputType = Result>(worker: Worker<undefined, OutputType>): Promise<OutputType | undefined> {
    return this.executeTask<undefined, OutputType>(worker).catch(async (e) => {
      await this.handleCriticalError(e);
      return undefined;
    });
  }

  /**
   * Map iterable data to worker function and return computed Task result as AsyncIterable
   *
   * @param data Iterable data
   * @param worker worker function
   * @return AsyncIterable with results of computed tasks
   * @example
   * ```typescript
   * const data = [1, 2, 3, 4, 5];
   * const results = executor.map(data, (ctx, item) => providerCtx.ctx(`echo "${item}"`));
   * for await (const result of results) console.log(result.stdout);
   * ```
   */
  map<InputType, OutputType>(
    data: Iterable<InputType>,
    worker: Worker<InputType, OutputType>
  ): AsyncIterable<OutputType | undefined> {
    const inputs = [...data];
    const featureResults = inputs.map((value) => this.executeTask<InputType, OutputType>(worker, value));
    const results: OutputType[] = [];
    let resultsCount = 0;
    featureResults.forEach((featureResult) =>
      featureResult
        .then((res) => {
          results.push(res as OutputType);
        })
        .catch((e) => this.handleCriticalError(e))
    );
    const isRunning = () => this.isRunning;
    return {
      [Symbol.asyncIterator](): AsyncIterator<OutputType | undefined> {
        return {
          async next() {
            if (resultsCount === inputs.length) {
              return Promise.resolve({ done: true, value: undefined });
            }
            while (results.length === 0 && resultsCount < inputs.length && isRunning()) {
              await sleep(1000, true);
            }
            if (!isRunning()) return Promise.resolve({ done: true, value: undefined });
            resultsCount += 1;
            return Promise.resolve({ done: false, value: results.pop() });
          },
        };
      },
    };
  }

  /**
   * Iterates over given data and execute task using worker function
   *
   * @param data Iterable data
   * @param worker Worker function
   * @example
   * ```typescript
   * const data = [1, 2, 3, 4, 5];
   * await executor.forEach(data, async (ctx, item) => {
   *     console.log((await ctx.run(`echo "${item}"`).stdout));
   * });
   * ```
   */
  async forEach<InputType, OutputType>(
    data: Iterable<InputType>,
    worker: Worker<InputType, OutputType>
  ): Promise<void> {
    await Promise.all([...data].map((value) => this.executeTask<InputType, OutputType>(worker, value))).catch((e) =>
      this.handleCriticalError(e)
    );
  }

  private async createPackage(imageHash: string): Promise<Package> {
    return Package.create({ ...this.options.packageOptions, imageHash });
  }

  private async executeTask<InputType, OutputType>(
    worker: Worker<InputType, OutputType>,
    data?: InputType
  ): Promise<OutputType | undefined> {
    const task = new Task<InputType, OutputType>(
      (++this.lastTaskIndex).toString(),
      worker,
      data,
      this.initWorker,
      this.options.maxTaskRetries
    );
    this.taskQueue.addToEnd(task);
    let timeout = false;
    const timeoutId = setTimeout(() => (timeout = true), this.options.taskTimeout);
    while (!timeout && this.isRunning) {
      if (task.isFinished()) {
        clearTimeout(timeoutId);
        if (task.isRejected()) throw task.getError();
        return task.getResults();
      }
      await sleep(2000, true);
    }
    clearTimeout(timeoutId);
    if (timeout) {
      const error = new Error(`Task ${task.id} timeout.`);
      task.stop(undefined, error, true);
      throw error;
    }
  }

  private handleCriticalError(e: Error) {
    this.options.eventTarget?.dispatchEvent(new Events.ComputationFailed({ reason: e.toString() }));
    this.logger?.error(e.toString());
    this.logger?.debug(e.stack);
    if (this.isRunning) this.logger?.warn("Trying to stop executor...");
    this.end().catch((e) => {
      this.logger?.error(e);
      process?.exit(1);
    });
    throw e;
  }

  private handleCancelEvent() {
    terminatingSignals.forEach((event) => process.on(event, this.cancel.bind(this)));
  }

  private removeCancelEvent() {
    terminatingSignals.forEach((event) => process.off(event, this.cancel.bind(this)));
  }

  private async cancel() {
    this.logger?.warn("Executor has interrupted by the user. Stopping all tasks...");
    await this.end().catch((error) => {
      this.logger?.error(error);
      process.exit(1);
    });
  }

  private printStats() {
    const costs = this.statsService.getAllCosts();
    const costsSummary = this.statsService.getAllCostsSummary();
    const duration = this.statsService.getComputationTime();
    const providersCount = new Set(costsSummary.map((x) => x["Provider Name"])).size;
    this.logger?.info(`Computation finished in ${duration}`);
    this.logger?.info(`Negotiated ${costsSummary.length} agreements with ${providersCount} providers`);
    if (costsSummary.length) this.logger?.table?.(costsSummary);
    this.logger?.info(`Total Cost: ${costs.total} Total Paid: ${costs.paid}`);
  }
}
