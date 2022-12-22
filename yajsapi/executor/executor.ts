import { GftpStorageProvider } from "../storage/gftp_provider";
import { Package } from "../package";
import { MarketService, MarketStrategy } from "../market";
import { AgreementPoolService } from "../agreement";
import { Task, TaskQueue, TaskService, Worker } from "../task";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { Result } from "../activity";
import { sleep, Logger, runtimeContextChecker } from "../utils";
import { StorageProvider } from "../storage/provider";
import { ExecutorConfig } from "./config";
import { Events } from "../events";
import { StatsService } from "../stats/service";

export type ExecutorOptions = {
  package: string | Package;
  maxParallelTasks?: number;
  timeout?: number;
  budget?: number;
  strategy?: MarketStrategy;
  subnetTag?: string;
  payment?: { driver?: string; network?: string };
  networkAddress?: string;
  engine?: string;
  minMemGib?: number;
  minStorageGib?: number;
  minCpuThreads?: number;
  minCpuCores?: number;
  capabilities?: string[];
  logger?: Logger;
  logLevel?: string;
  yagnaOptions?: YagnaOptions;
  eventTarget?: EventTarget;
};

export type ExecutorOptionsMixin = string | ExecutorOptions;

export type YagnaOptions = {
  apiKey: string;
  basePath: string;
};

export class TaskExecutor {
  private readonly options: ExecutorConfig;
  private readonly imageHash?: string;
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
    this.storageProvider = runtimeContextChecker.isNode ? new GftpStorageProvider() : undefined;
    this.taskService = new TaskService(
      this.taskQueue,
      this.agreementPoolService,
      this.paymentService,
      this.networkService,
      { ...this.options, storageProvider: this.storageProvider }
    );
    this.statsService = new StatsService(this.options);
  }

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
    this.options.eventTarget.dispatchEvent(new Events.ComputationStarted());
    this.logger?.info(
      `Task Executor has started using subnet ${this.options.subnetTag}, network: ${this.options.payment?.network}, driver: ${this.options.payment?.driver}`
    );
  }

  async end() {
    await this.marketService.end();
    await this.agreementPoolService.end();
    await this.taskService.end();
    await this.networkService?.end();
    await this.paymentService.end();
    this.storageProvider?.close();
    this.options.eventTarget?.dispatchEvent(new Events.ComputationFinished());
    this.logger?.table?.(this.statsService.getAllCosts());
    await this.statsService.end();
    this.logger?.info("Task Executor has shut down");
  }

  getStats() {
    return {
      computationsInfo: this.statsService.getComputationsInfo(),
      allCosts: this.statsService.getAllCosts() as object,
    };
  }

  beforeEach(worker: Worker) {
    this.initWorker = worker;
  }

  async run<OutputType = Result>(worker: Worker<undefined, OutputType>): Promise<OutputType | undefined> {
    return this.executeTask<undefined, OutputType>(worker);
  }

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
    return {
      [Symbol.asyncIterator](): AsyncIterator<OutputType | undefined> {
        return {
          async next() {
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
    while (!timeout) {
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

export async function createExecutor(options: ExecutorOptionsMixin) {
  const executor = new TaskExecutor(options);
  await executor.init();
  return executor;
}
