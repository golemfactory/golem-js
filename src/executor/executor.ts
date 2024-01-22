import { Package, PackageOptions } from "../package";
import { MarketService } from "../market";
import { AgreementPoolService } from "../agreement";
import { Task, TaskOptions, TaskQueue, TaskService, Worker } from "../task";
import { PaymentOptions, PaymentService } from "../payment";
import { NetworkService } from "../network";
import { Logger, runtimeContextChecker, sleep, Yagna } from "../utils";
import { GftpStorageProvider, NullStorageProvider, StorageProvider, WebSocketBrowserStorageProvider } from "../storage";
import { ExecutorConfig } from "./config";
import { Events } from "../events";
import { StatsService } from "../stats/service";
import { TaskServiceOptions } from "../task/service";
import { NetworkServiceOptions } from "../network/service";
import { AgreementServiceOptions } from "../agreement/service";
import { MarketOptions } from "../market/service";
import { RequireAtLeastOne } from "../utils/types";
import { TaskExecutorEventsDict } from "./events";
import { EventEmitter } from "eventemitter3";
import { GolemError } from "../error/golem-error";
import { WorkOptions } from "../task/work";

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
   * Currently, has no effect on executor termination.
   */
  isSubprocess?: boolean;
  /** Timeout for preparing activity - creating and deploy commands */
  activityPreparingTimeout?: number;
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
   * Timeout for waiting for at least one offer from the market expressed in milliseconds.
   * This parameter (set to 90 sec by default) will issue a warning when executing `TaskExecutor.run`
   * if no offer from the market is accepted before this time. If you'd like to change this behavior,
   * and throw an error instead, set `exitOnNoProposals` to `true`.
   * You can set a slightly higher time in a situation where your parameters such as proposalFilter
   * or minimum hardware requirements are quite restrictive and finding a suitable provider
   * that meets these criteria may take a bit longer.
   */
  startupTimeout?: number;
  /**
   * If set to `true`, the executor will exit with an error when no proposals are accepted.
   * You can customize how long the executor will wait for proposals using the `startupTimeout` parameter.
   * Default is `false`.
   */
  exitOnNoProposals?: boolean;
} & Omit<PackageOptions, "imageHash" | "imageTag"> &
  MarketOptions &
  TaskServiceOptions &
  PaymentOptions &
  NetworkServiceOptions &
  AgreementServiceOptions &
  WorkOptions;

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
  /**
   * EventEmitter (EventEmitter3) instance emitting TaskExecutor events.
   * @see TaskExecutorEventsDict for available events.
   */
  readonly events: EventEmitter<TaskExecutorEventsDict> = new EventEmitter();

  private readonly options: ExecutorConfig;
  private marketService: MarketService;
  private agreementPoolService: AgreementPoolService;
  private taskService: TaskService;
  private paymentService: PaymentService;
  private networkService?: NetworkService;
  private statsService: StatsService;
  private activityReadySetupFunctions: Worker<unknown>[] = [];
  private taskQueue: TaskQueue;
  private storageProvider?: StorageProvider;
  private logger: Logger;
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
   * Shutdown promise.
   * This will be set by call to shutdown() method.
   * It will be resolved when the executor is fully stopped.
   */
  private shutdownPromise?: Promise<void>;

  /**
   * Create a new Task Executor
   * @description Factory Method that create and initialize an instance of the TaskExecutor
   *
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
   *   payment: { driver: "erc-20", network: "holesky" },
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
   *
   * @param options - contains information needed to start executor, if string the imageHash is required, otherwise it should be a type of {@link ExecutorOptions}
   */
  constructor(options: ExecutorOptionsMixin) {
    this.configOptions = (typeof options === "string" ? { package: options } : options) as ExecutorOptions;
    this.options = new ExecutorConfig(this.configOptions);
    this.logger = this.options.logger;
    this.yagna = new Yagna(this.configOptions.yagnaOptions);
    const yagnaApi = this.yagna.getApi();
    this.taskQueue = new TaskQueue();
    this.agreementPoolService = new AgreementPoolService(yagnaApi, {
      ...this.options,
      logger: this.logger.child("agreement"),
    });
    this.paymentService = new PaymentService(yagnaApi, {
      ...this.options,
      logger: this.logger.child("payment"),
    });
    this.marketService = new MarketService(this.agreementPoolService, yagnaApi, {
      ...this.options,
      logger: this.logger.child("market"),
    });
    this.networkService = this.options.networkIp
      ? new NetworkService(yagnaApi, { ...this.options, logger: this.logger.child("network") })
      : undefined;

    // Initialize storage provider.
    if (this.configOptions.storageProvider) {
      this.storageProvider = this.configOptions.storageProvider;
    } else if (runtimeContextChecker.isNode) {
      this.storageProvider = new GftpStorageProvider(this.logger.child("storage"));
    } else if (runtimeContextChecker.isBrowser) {
      this.storageProvider = new WebSocketBrowserStorageProvider(yagnaApi, {
        ...this.options,
        logger: this.logger.child("storage"),
      });
    } else {
      this.storageProvider = new NullStorageProvider();
    }

    this.taskService = new TaskService(
      this.yagna.getApi(),
      this.taskQueue,
      this.agreementPoolService,
      this.paymentService,
      this.networkService,
      { ...this.options, storageProvider: this.storageProvider, logger: this.logger.child("work") },
    );
    this.statsService = new StatsService({ ...this.options, logger: this.logger.child("stats") });
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
      this.logger.error("Initialization failed", error);
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
        const error = new GolemError("No package or manifest provided");
        this.logger.error("No package or manifest provided", error);
        throw error;
      }
    }

    this.logger.debug("Initializing task executor services...");
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
    this.logger.info(`Task Executor has started`, {
      subnet: this.options.subnetTag,
      network: this.paymentService.config.payment.network,
      driver: this.paymentService.config.payment.driver,
    });
    this.events.emit("ready");
  }

  /**
   * Stop all executor services and shut down executor instance.
   *
   * You can call this method multiple times, it will resolve only once the executor is shutdown.
   *
   * @deprecated Use TaskExecutor.shutdown() instead.
   */
  end(): Promise<void> {
    return this.shutdown();
  }

  /**
   * Stop all executor services and shut down executor instance.
   *
   * You can call this method multiple times, it will resolve only once the executor is shutdown.
   *
   * When shutdown() is initially called, a beforeEnd event is emitted.
   *
   * Once the executor is fully stopped, an end event is emitted.
   */
  shutdown(): Promise<void> {
    if (!this.isRunning) {
      // Using ! is safe, because if isRunning is false, endPromise is defined.
      return this.shutdownPromise!;
    }

    this.isRunning = false;
    this.shutdownPromise = this.doShutdown();

    return this.shutdownPromise;
  }

  /**
   * Perform everything needed to cleanly shut down the executor.
   * @private
   */
  private async doShutdown() {
    this.events.emit("beforeEnd");
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
    this.logger.info("Task Executor has shut down");
    this.events.emit("end");
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
   * @deprecated
   * Use {@link TaskExecutor.onActivityReady} instead.
   *
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
  beforeEach(worker: Worker<unknown>) {
    this.activityReadySetupFunctions = [worker];
  }

  /**
   * Registers a worker function that will be run when an activity is ready.
   * This is the perfect place to run setup functions that need to be run only once per
   * activity, for example uploading files that will be used by all tasks in the activity.
   * This function can be called multiple times, each worker will be run in the order
   * they were registered.
   *
   * @param worker worker function that will be run when an activity is ready
   * @example
   * ```ts
   * const uploadFile1 = async (ctx) => ctx.uploadFile("./file1.txt", "/file1.txt");
   * const uploadFile2 = async (ctx) => ctx.uploadFile("./file2.txt", "/file2.txt");
   *
   * executor.onActivityReady(uploadFile1);
   * executor.onActivityReady(uploadFile2);
   *
   * await executor.run(async (ctx) => {
   *  await ctx.run("cat /file1.txt /file2.txt");
   * });
   * ```
   */
  onActivityReady(worker: Worker<unknown>) {
    this.activityReadySetupFunctions.push(worker);
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
  async run<OutputType>(worker: Worker<OutputType>, options?: TaskOptions): Promise<OutputType> {
    return this.executeTask<OutputType>(worker, options);
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

  private async executeTask<OutputType>(worker: Worker<OutputType>, options?: TaskOptions): Promise<OutputType> {
    const task = new Task((++this.lastTaskIndex).toString(), worker, {
      maxRetries: options?.maxRetries ?? this.options.maxTaskRetries,
      timeout: options?.timeout ?? this.options.taskTimeout,
      activityReadySetupFunctions: this.activityReadySetupFunctions,
    });
    this.taskQueue.addToEnd(task);
    while (this.isRunning) {
      if (task.isFinished()) {
        if (task.isRejected()) throw task.getError();
        return task.getResults() as OutputType;
      }
      await sleep(2000, true);
    }
    throw new GolemError("Task executor has been stopped");
  }

  private handleCriticalError(e: Error) {
    this.options.eventTarget?.dispatchEvent(new Events.ComputationFailed({ reason: e.toString() }));
    this.logger.error("Critical error", e);
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
      this.logger.warn(`${message}. Stopping all tasks...`, {
        tasksInProgress: this.taskQueue.size,
      });
      this.isCanceled = true;
      await this.shutdown();
    } catch (error) {
      this.logger.error(`Error while cancelling the executor`, error);
    }
  }

  private printStats() {
    const costs = this.statsService.getAllCosts();
    const costsSummary = this.statsService.getAllCostsSummary();
    const duration = this.statsService.getComputationTime();
    const providersCount = new Set(costsSummary.map((x) => x["Provider Name"])).size;
    this.logger.info(`Computation finished in ${duration}`);
    this.logger.info(`Negotiation summary:`, {
      agreements: costsSummary.length,
      providers: providersCount,
    });
    costsSummary.forEach((cost, index) => {
      this.logger.info(`Agreement ${index + 1}:`, {
        agreement: cost["Agreement"],
        provider: cost["Provider Name"],
        tasks: cost["Task Computed"],
        cost: cost["Cost"],
        paymentStatus: cost["Payment Status"],
      });
    });
    this.logger.info(`Cost summary:`, {
      totalCost: costs.total,
      totalPaid: costs.paid,
    });
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
        const errorMessage = `Could not start any work on Golem. Processed ${proposalsCount.initial} initial proposals from yagna, filters accepted ${proposalsCount.confirmed}. ${hint}`;
        if (this.options.exitOnNoProposals) {
          this.handleCriticalError(new GolemError(errorMessage));
        } else {
          console.error(errorMessage);
        }
      }
    }, this.options.startupTimeout);
  }
}
