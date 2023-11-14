import { Package, PackageOptions } from "../package";
import { MarketService } from "../market";
import { AgreementPoolService } from "../agreement";
import { Task, TaskQueue, TaskService, Worker, TaskOptions } from "../task";
import { PaymentService, PaymentOptions } from "../payment";
import { NetworkService } from "../network";
import { Result } from "../activity";
import { sleep, Logger, LogLevel, runtimeContextChecker, Yagna } from "../utils";
import { StorageProvider, GftpStorageProvider, NullStorageProvider, WebSocketBrowserStorageProvider } from "../storage";
import { ExecutorConfig } from "./config";
import { Events } from "../events";
import { StatsService } from "../stats/service";
import { TaskServiceOptions } from "../task/service";
import { NetworkServiceOptions } from "../network/service";
import { AgreementServiceOptions } from "../agreement/service";
import { WorkOptions } from "../task/work";
import { MarketOptions } from "../market/service";
import { RequireAtLeastOne } from "../utils/types";
import { v4 } from "uuid";
import { JobStorage, Job } from "../job";

const terminatingSignals = ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"];

export type ExecutorOptions = {
  /** Image hash or image tag as string, otherwise Package object */
  package?: string | Package;
  /** Timeout for execute one task in ms */
  taskTimeout?: number;
  /** Subnet Tag */
  subnetTag?: string;
  /** Logger module */
  logger?: Logger;
  /** Log level: debug, info, warn, log, error */
  logLevel?: LogLevel | string;
  /** Set to `false` to completely disable logging (even if a logger is provided) */
  enableLogging?: boolean;
  /** Yagna Options */
  yagnaOptions?: YagnaOptions;
  /** Event Bus implements EventTarget  */
  eventTarget?: EventTarget;
  /** The maximum number of retries when the job failed on the provider */
  maxTaskRetries?: number;
  /** Custom Storage Provider used for transfer files */
  storageProvider?: StorageProvider;
  /**
   * @deprecated this parameter will be removed in the next version.
   * Currently has no effect on executor termination.
   */
  isSubprocess?: boolean;
  /** Timeout for preparing activity - creating and deploy commands */
  activityPreparingTimeout?: number;
  /**
   * Storage for task state and results. Especially useful in a distributed environment.
   * For more details see {@link JobStorage}. Defaults to a simple in-memory storage.
   */
  jobStorage?: JobStorage;
  /**
   * Do not install signal handlers for SIGINT, SIGTERM, SIGBREAK, SIGHUP.
   *
   * By default, TaskExecutor will install those and terminate itself when any of those signals is received.
   * This is to make sure proper shutdown with completed invoice payments.
   *
   * Note: If you decide to set this to `true`, you will be responsible for proper shutdown of task executor.
   */
  skipProcessSignals?: boolean;
  /**
   * Timeout for waiting for at least one offer from the market.
   * This parameter (set to 30 sec by default) will throw an error when executing `TaskExecutor.run`
   * if no offer from the market is accepted before this time.
   * You can set a slightly higher time in a situation where your parameters such as proposalFilter
   * or minimum hardware requirements are quite restrictive and finding a suitable provider
   * that meets these criteria may take a bit longer.
   */
  startupTimeout?: number;
} & Omit<PackageOptions, "imageHash" | "imageTag"> &
  MarketOptions &
  TaskServiceOptions &
  PaymentOptions &
  NetworkServiceOptions &
  AgreementServiceOptions &
  Omit<WorkOptions, "isRunning">;

/**
 * Contains information needed to start executor, if string the imageHash is required, otherwise it should be a type of {@link ExecutorOptions}
 */
export type ExecutorOptionsMixin = string | ExecutorOptions;

export type YagnaOptions = {
  apiKey?: string;
  basePath?: string;
};

/**
 * A high-level module for defining and executing tasks in the golem network
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
  private taskQueue: TaskQueue<Task<unknown, unknown>>;
  private storageProvider?: StorageProvider;
  private logger?: Logger;
  private lastTaskIndex = 0;
  private isRunning = true;
  private configOptions: ExecutorOptions;
  private isCanceled = false;
  private startupTimeoutId?: NodeJS.Timeout;
  private yagna: Yagna;

  /**
   * Signal handler reference, needed to remove handlers on exit.
   * @param signal
   */
  private signalHandler = (signal: string) => this.cancel(signal);

  /**
   * End promise.
   * This will be set by call to end() method.
   * It will be resolved when the executor is fully stopped.
   */
  private endPromise?: Promise<void>;

  /**
   * Create a new Task Executor
   * @description Factory Method that create and initialize an instance of the TaskExecutor
   *
   * @example **Simple usage of Task Executor**
   *
   * The executor can be created by passing appropriate initial parameters such as package, budget, subnet tag, payment driver, payment network etc.
   * One required parameter is a package. This can be done in two ways. First by passing only package image hash or image tag, e.g.
   * ```js
   * const executor = await TaskExecutor.create("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
   * ```
   * or
   * ```js
   * const executor = await TaskExecutor.create("golem/alpine:3.18.2");
   * ```
   *
   * @example **Usage of Task Executor with custom parameters**
   *
   * Or by passing some optional parameters, e.g.
   * ```js
   * const executor = await TaskExecutor.create({
   *   subnetTag: "public",
   *   payment: { driver: "erc-20", network: "goerli" },
   *   package: "golem/alpine:3.18.2",
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
    this.yagna = new Yagna(this.configOptions.yagnaOptions);
    const yagnaApi = this.yagna.getApi();
    this.taskQueue = new TaskQueue<Task<unknown, unknown>>();
    this.agreementPoolService = new AgreementPoolService(yagnaApi, this.options);
    this.paymentService = new PaymentService(yagnaApi, this.options);
    this.marketService = new MarketService(this.agreementPoolService, yagnaApi, this.options);
    this.networkService = this.options.networkIp ? new NetworkService(yagnaApi, this.options) : undefined;

    // Initialize storage provider.
    if (this.configOptions.storageProvider) {
      this.storageProvider = this.configOptions.storageProvider;
    } else if (runtimeContextChecker.isNode) {
      this.storageProvider = new GftpStorageProvider(this.logger);
    } else if (runtimeContextChecker.isBrowser) {
      this.storageProvider = new WebSocketBrowserStorageProvider(yagnaApi, this.options);
    } else {
      this.storageProvider = new NullStorageProvider();
    }

    this.taskService = new TaskService(
      this.yagna.getApi(),
      this.taskQueue,
      this.agreementPoolService,
      this.paymentService,
      this.networkService,
      { ...this.options, storageProvider: this.storageProvider },
    );
    this.statsService = new StatsService(this.options);
  }

  /**
   * Initialize executor
   *
   * @description Method responsible initialize all executor services.
   */
  async init() {
    try {
      await this.yagna.connect();
    } catch (error) {
      this.logger?.error(error);
      throw error;
    }
    const manifest = this.options.packageOptions.manifest;
    const packageReference = this.options.package;
    let taskPackage: Package;

    if (manifest) {
      taskPackage = await this.createPackage({
        manifest,
      });
    } else {
      if (packageReference) {
        if (typeof packageReference === "string") {
          taskPackage = await this.createPackage(Package.getImageIdentifier(packageReference));
        } else {
          taskPackage = packageReference;
        }
      } else {
        const error = new Error("No package or manifest provided");
        this.logger?.error(error);
        throw error;
      }
    }

    this.logger?.debug("Initializing task executor services...");
    const allocations = await this.paymentService.createAllocation();
    await Promise.all([
      this.marketService.run(taskPackage, allocations).then(() => this.setStartupTimeout()),
      this.agreementPoolService.run(),
      this.paymentService.run(),
      this.networkService?.run(),
      this.statsService.run(),
      this.storageProvider?.init(),
    ]).catch((e) => this.handleCriticalError(e));
    this.taskService.run().catch((e) => this.handleCriticalError(e));
    if (runtimeContextChecker.isNode) this.installSignalHandlers();
    this.options.eventTarget.dispatchEvent(new Events.ComputationStarted());
    this.logger?.info(
      `Task Executor has started using subnet: ${this.options.subnetTag}, network: ${this.paymentService.config.payment.network}, driver: ${this.paymentService.config.payment.driver}`,
    );
  }

  /**
   * Stop all executor services and shut down executor instance.
   *
   * You can call this method multiple times, it will resolve only once the executor is shutdown.
   */
  end(): Promise<void> {
    if (this.isRunning) {
      this.isRunning = false;
      this.endPromise = this.doEnd();
    }

    return this.endPromise!;
  }

  /**
   * Perform everything needed to cleanly shut down the executor.
   * @private
   */
  private async doEnd() {
    if (runtimeContextChecker.isNode) this.removeSignalHandlers();
    clearTimeout(this.startupTimeoutId);
    if (!this.configOptions.storageProvider) await this.storageProvider?.close();
    await this.networkService?.end();
    await Promise.all([this.taskService.end(), this.agreementPoolService.end(), this.marketService.end()]);
    await this.paymentService.end();
    await this.yagna.end();
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
   * @param options task options
   * @return result of task computation
   * @example
   * ```typescript
   * await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
   * ```
   */
  async run<OutputType = Result>(
    worker: Worker<undefined, OutputType>,
    options?: TaskOptions,
  ): Promise<OutputType | undefined> {
    return this.executeTask<undefined, OutputType>(worker, undefined, options).catch(async (e) => {
      this.handleCriticalError(e);
      return undefined;
    });
  }

  /**
   * @deprecated This method is marked for removal in a future release. Migrate your code by using `Array.map` and `Promise.all` instead.
   * @example
   * ```typescript
   * const data = [1, 2, 3, 4, 5];
   * const futureResults = data.map((item) =>
   *   executor.run((ctx) => {
   *     console.log((await ctx.run(`echo "${item}"`)).stdout);
   *   })
   * );
   * const results = await Promise.all(futureResults);
   * ```
   *
   * Map iterable data to worker function and return computed Task result as AsyncIterable
   *
   * @param data Iterable data
   * @param worker worker function
   * @return AsyncIterable with results of computed tasks
   * @example
   * ```typescript
   * const data = [1, 2, 3, 4, 5];
   * const results = executor.map(data, (ctx, item) => ctx.run(`echo "${item}"`));
   * for await (const result of results) console.log(result.stdout);
   * ```
   */
  map<InputType, OutputType>(
    data: Iterable<InputType>,
    worker: Worker<InputType, OutputType>,
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
        .catch((e) => this.handleCriticalError(e)),
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
   * @deprecated This method is marked for removal in a future release.
   * Migrate your code by using `Array.map` and `Promise.all` instead.
   * @example
   * ```typescript
   * const data = [1, 2, 3, 4, 5];
   * const futureResults = data.map((item) =>
   *   executor.run((ctx) => {
   *     console.log((await ctx.run(`echo "${item}"`)).stdout);
   *   }),
   * );
   * await Promise.all(futureResults);
   * ```
   *
   * Iterates over given data and execute task using worker function
   *
   * @param data Iterable data
   * @param worker Worker function
   * @example
   * ```typescript
   * const data = [1, 2, 3, 4, 5];
   * await executor.forEach(data, async (ctx, item) => {
   *     console.log((await ctx.run(`echo "${item}"`)).stdout);
   * });
   * ```
   */
  async forEach<InputType, OutputType>(
    data: Iterable<InputType>,
    worker: Worker<InputType, OutputType>,
  ): Promise<void> {
    await Promise.all([...data].map((value) => this.executeTask<InputType, OutputType>(worker, value))).catch((e) =>
      this.handleCriticalError(e),
    );
  }

  private async createPackage(
    packageReference: RequireAtLeastOne<
      { imageHash: string; manifest: string; imageTag: string },
      "manifest" | "imageTag" | "imageHash"
    >,
  ): Promise<Package> {
    const packageInstance = Package.create({ ...this.options.packageOptions, ...packageReference });

    this.options.eventTarget.dispatchEvent(
      new Events.PackageCreated({ packageReference, details: packageInstance.details }),
    );

    return packageInstance;
  }

  private async executeTask<InputType, OutputType>(
    worker: Worker<InputType, OutputType>,
    data?: InputType,
    options?: TaskOptions,
  ): Promise<OutputType | undefined> {
    const task = new Task<InputType, OutputType>((++this.lastTaskIndex).toString(), worker, data, this.initWorker, {
      maxRetries: options?.maxRetries ?? this.options.maxTaskRetries,
      timeout: options?.timeout ?? this.options.taskTimeout,
    });
    this.taskQueue.addToEnd(task as Task<unknown, unknown>);
    while (this.isRunning) {
      if (task.isFinished()) {
        if (task.isRejected()) throw task.getError();
        return task.getResults();
      }
      await sleep(2000, true);
    }
  }

  /**
   * Start a new job without waiting for the result. The job can be retrieved later using {@link TaskExecutor.getJobById}. The job's status is stored in the {@link JobStorage} provided in the {@link ExecutorOptions} (in-memory by default). For distributed environments, it is recommended to use a form of storage that is accessible from all nodes (e.g. a database).
   *
   * @param worker Worker function to be executed
   * @returns Job object
   * @example **Simple usage of createJob**
   * ```typescript
   * const job = executor.createJob(async (ctx) => {
   *  return (await ctx.run("echo 'Hello World'")).stdout;
   * });
   * // save job.id somewhere
   *
   * // later...
   * const job = await executor.fetchJob(jobId);
   * const status = await job.fetchState();
   * const results = await job.fetchResults();
   * const error = await job.fetchError();
   * ```
   */
  public async createJob<InputType = unknown, OutputType = unknown>(
    worker: Worker<InputType, OutputType>,
  ): Promise<Job<OutputType>> {
    const jobId = v4();
    const job = new Job<OutputType>(jobId, this.options.jobStorage);
    await job.saveInitialState();

    const task = new Task(jobId, worker, undefined, this.initWorker, {
      maxRetries: this.options.maxTaskRetries,
      timeout: this.options.taskTimeout,
    });
    task.onStateChange((taskState) => {
      job.saveState(taskState, task.getResults(), task.getError());
    });
    this.taskQueue.addToEnd(task as Task<unknown, unknown>);

    return job;
  }

  /**
   * Retrieve a job by its ID. The job's status is stored in the {@link JobStorage} provided in the {@link ExecutorOptions} (in-memory by default). Use {@link Job.fetchState}, {@link Job.fetchResults} and {@link Job.fetchError} to get the job's status.
   *
   * @param jobId Job ID
   * @returns Job object.
   */
  public getJobById(jobId: string): Job {
    return new Job(jobId, this.options.jobStorage);
  }

  private handleCriticalError(e: Error) {
    this.options.eventTarget?.dispatchEvent(new Events.ComputationFailed({ reason: e.toString() }));
    this.logger?.error(e.toString());
    if (this.isRunning) this.logger?.warn("Trying to stop executor...");
    this.end().catch((e) => this.logger?.error(e));
  }

  private installSignalHandlers() {
    if (this.configOptions.skipProcessSignals) return;
    terminatingSignals.forEach((event) => {
      process.on(event, this.signalHandler);
    });
  }

  private removeSignalHandlers() {
    if (this.configOptions.skipProcessSignals) return;
    terminatingSignals.forEach((event) => {
      process.removeListener(event, this.signalHandler);
    });
  }

  public async cancel(reason?: string) {
    try {
      if (this.isCanceled) return;
      if (runtimeContextChecker.isNode) this.removeSignalHandlers();
      const message = `Executor has interrupted by the user. Reason: ${reason}.`;
      this.logger?.warn(`${message}. Stopping all tasks...`);
      this.isCanceled = true;
      await this.end();
    } catch (error) {
      this.logger?.error(`Error while cancelling the executor. ${error}`);
    }
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

  /**
   * Sets a timeout for waiting for offers from the market.
   * If at least one offer is not confirmed during the set timeout,
   * a critical error will be reported and the entire process will be interrupted.
   */
  private setStartupTimeout() {
    this.startupTimeoutId = setTimeout(() => {
      const proposalsCount = this.marketService.getProposalsCount();
      if (proposalsCount.confirmed === 0) {
        const hint =
          proposalsCount.initial === 0 && proposalsCount.confirmed === 0
            ? "Check your demand if it's not too restrictive or restart yagna."
            : proposalsCount.initial === proposalsCount.rejected
              ? "All off proposals got rejected."
              : "Check your proposal filters if they are not too restrictive.";
        this.handleCriticalError(
          new Error(
            `Could not start any work on Golem. Processed ${proposalsCount.initial} initial proposals from yagna, filters accepted ${proposalsCount.confirmed}. ${hint}`,
          ),
        );
      }
    }, this.options.startupTimeout);
  }
}
