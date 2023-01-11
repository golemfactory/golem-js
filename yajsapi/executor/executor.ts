import { Package } from "../package";
import { MarketService, MarketStrategy } from "../market";
import { AgreementPoolService } from "../agreement";
import { Task, TaskQueue, TaskService, Worker } from "../task";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { Result } from "../activity";
import { sleep, Logger, runtimeContextChecker } from "../utils";
import { StorageProvider, GftpStorageProvider } from "../storage/";
import { ExecutorConfig } from "./config";
import { Events } from "../events";
import { StatsService } from "../stats/service";

export type ExecutorOptions = {
  /** Image hash as string, otherwise Package object */
  package: string | Package;
  /** Number of maximum parallel running task on one TaskExecutor instance */
  maxParallelTasks?: number;
  /** Timeout for execute one task in ms */
  timeout?: number;
  /** TODO */
  budget?: number;
  /** Strategy used to choose best offer */
  strategy?: MarketStrategy;
  /** Subnet Tag */
  subnetTag?: string;
  /** TODO */
  payment?: { driver?: string; network?: string };
  /** TODO */
  networkAddress?: string;
  /** TODO */
  engine?: string;
  /** Minimum required memory from provider instance in GB */
  minMemGib?: number;
  /** Minimum required storage from provider instance in GB */
  minStorageGib?: number;
  /** Minimum required CPU threads */
  minCpuThreads?: number;
  /** Minimum required CPU cores */
  minCpuCores?: number;
  /** TODO */
  capabilities?: string[];
  /** Logger module */
  logger?: Logger;
  /** TODO enum: debug, info, warn, error */
  logLevel?: string; // TODO: enum ?
  /** Yagna Options */
  yagnaOptions?: YagnaOptions;
  /** Event Bus implements EventTarget  */
  eventTarget?: EventTarget;
};

export type ExecutorOptionsMixin = string | ExecutorOptions;

export type YagnaOptions = {
  apiKey: string;
  basePath: string;
};

export class TaskExecutor {
  private readonly options: ExecutorConfig;
  private readonly imageHash?: string; // TODO: not used
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

  /**
   * Create a new TaskExecutor object.
   * @description Use {@link TaskExecutor.create} for creating a task executor
   *
   * @param options - contains information needed to start executor, if string the imageHash is required, otherwise it should be a type of {@link ExecutorOptions}
   * @ignore
   */
  constructor(options: ExecutorOptionsMixin) {
    const configOptions: ExecutorOptions =
      typeof options === "string" ? { package: options } : (options as ExecutorOptions);
    this.options = new ExecutorConfig(configOptions);
    this.logger = this.options.logger;
    this.taskQueue = new TaskQueue<Task<any, any>>();
    this.agreementPoolService = new AgreementPoolService(this.options);
    this.paymentService = new PaymentService(this.options);
    this.marketService = new MarketService(this.agreementPoolService, this.options);
    this.networkService = this.options.networkAddress ? new NetworkService(this.options) : undefined;
    this.storageProvider = runtimeContextChecker.isNode ? new GftpStorageProvider(this.logger) : undefined;
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
    const terminatingSignals = ["SIGINT", "SIGTERM", "SIGBREAK", "SIGHUP"];
    terminatingSignals.forEach((event) => process.on(event, () => this.end(true)));
    this.options.eventTarget.dispatchEvent(new Events.ComputationStarted());
    this.logger?.info(
      `Task Executor has started using subnet ${this.options.subnetTag}, network: ${this.options.payment?.network}, driver: ${this.options.payment?.driver}`
    );
  }

  /**
   * End executor process
   *
   * @description Method responsible for stopping all executor services and shut down executor instance
   */
  async end(interrupt = false) {
    if (interrupt) this.logger?.warn("Executor has interrupted by the user. Stopping all tasks...");
    this.isRunning = false;
    await this.networkService?.end();
    await this.taskService.end();
    await this.agreementPoolService.end();
    await this.marketService.end();
    await this.paymentService.end();
    this.storageProvider?.close();
    this.options.eventTarget?.dispatchEvent(new Events.ComputationFinished());
    this.logger?.table?.(this.statsService.getAllCosts());
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
   * Define worker function that will be runs before every each computation Task
   *
   * @param worker worker function
   */
  beforeEach(worker: Worker) {
    this.initWorker = worker;
  }

  /**
   * Run task
   *
   * @param worker function that run task
   * @return computed task
   */
  async run<OutputType = Result>(worker: Worker<undefined, OutputType>): Promise<OutputType | undefined> {
    return this.executeTask<undefined, OutputType>(worker);
  }

  /**
   * Map iterable data to worker function and return computed Task result as AsyncIterable
   *
   * @param data Iterable data
   * @param worker worker function
   * @return AsyncIterable with results of computed tasks
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
      featureResult.then((res) => {
        if (res) results.push(res);
      })
    );
    const isRunning = () => this.isRunning;
    return {
      [Symbol.asyncIterator](): AsyncIterator<OutputType | undefined> {
        return {
          async next() {
            if (!isRunning()) return Promise.reject("Task Executor is not running");
            if (resultsCount === inputs.length) {
              return Promise.resolve({ done: true, value: undefined });
            }
            while (results.length === 0 && resultsCount < inputs.length) {
              await sleep(1000, true);
            }
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
   */
  async forEach<InputType, OutputType>(
    data: Iterable<InputType>,
    worker: Worker<InputType, OutputType>
  ): Promise<void> {
    await Promise.all([...data].map((value) => this.executeTask<InputType, OutputType>(worker, value)));
  }

  private async createPackage(imageHash: string): Promise<Package> {
    return Package.create({ ...this.options, imageHash });
  }

  private async executeTask<InputType, OutputType>(
    worker: Worker<InputType, OutputType>,
    data?: InputType
  ): Promise<OutputType | undefined> {
    const task = new Task<InputType, OutputType>((++this.lastTaskIndex).toString(), worker, data, this.initWorker);
    this.taskQueue.addToEnd(task);
    let timeout = false;
    const timeoutId = setTimeout(() => (timeout = true), this.options.timeout);
    while (!timeout && this.isRunning) {
      if (task.isFinished()) {
        clearTimeout(timeoutId);
        return task.getResults();
      }
      await sleep(2000, true);
    }
  }

  private handleCriticalError(e: Error) {
    this.options.eventTarget?.dispatchEvent(new Events.ComputationFailed({ reason: e.toString() }));
    this.logger?.error(e.toString());
    this.logger?.debug(e.stack);
    this.logger?.warn("Trying to stop all services...");
    this.end()
      .catch((e) => {
        this.logger?.error(e);
        process.exit(2);
      })
      .then(() => {
        process.exit(1);
      });
  }
}

/**
 * Create a new Task Executor
 *
 * @description Factory Method that create and initialize an instance of the TaskExecutor
 *
 * @param options Task executor options
 * @return TaskExecutor
 */
export async function createExecutor(options: ExecutorOptionsMixin) {
  const executor = new TaskExecutor(options);
  await executor.init();
  return executor;
}
