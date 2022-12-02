import { GftpStorageProvider } from "../storage/gftp_provider";
import { Package, repo } from "../package";
import { MarketService, MarketStrategy } from "../market";
import { AgreementPoolService } from "../agreement";
import { Task, TaskQueue, TaskService, Worker } from "../task";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { Result } from "../activity";
import { sleep, Logger, runtimeContextChecker, winstonLogger } from "../utils";
import { StorageProvider } from "../storage/provider";
import { ExecutorConfig } from "./config";

export type ExecutorOptions = {
  package: string | Package;
  maxWorkers?: number;
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
  cores?: number;
  capabilities?: string[];
  logger?: Logger;
  logLevel?: string;
  yagnaOptions?: YagnaOptions;
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
  private networkService: NetworkService;
  private initWorker?: Worker<unknown, unknown>;
  private taskQueue: TaskQueue<Task<any, any>>;
  private storageProvider?: StorageProvider;
  private logger?: Logger;

  constructor(options: ExecutorOptionsMixin) {
    this.options = new ExecutorConfig(
      typeof options === "string" ? { package: options } : (options as ExecutorOptions)
    );
    this.logger = this.options.logger;
    if (!this.options.logger && !runtimeContextChecker.isBrowser) this.logger = winstonLogger;
    this.logger?.setLevel && this.logger?.setLevel(this.options.logLevel);
    this.taskQueue = new TaskQueue<Task<any, any>>();
    this.agreementPoolService = new AgreementPoolService();
    this.networkService = new NetworkService(this.options);
    this.paymentService = new PaymentService(this.options);
    this.marketService = new MarketService(this.agreementPoolService, this.options);
    this.storageProvider = new GftpStorageProvider();
    this.taskService = new TaskService(
      this.taskQueue,
      this.agreementPoolService,
      this.paymentService,
      this.networkService,
      this.options
    );
  }

  async init() {
    const taskPackage =
      typeof this.options.package === "string" ? await this.createPackage(this.options.package) : this.options.package;
    this.logger?.debug("Initializing task executor services...");
    const allocations = await this.paymentService.getAllocations();
    this.marketService.run(taskPackage, allocations).catch((e) => this.handleCriticalError(e));
    this.agreementPoolService.run().catch((e) => this.handleCriticalError(e));
    this.paymentService.run().catch((e) => this.handleCriticalError(e));
    this.taskService.run().catch((e) => this.handleCriticalError(e));
    if (this.options.networkAddress) {
      this.networkService.run(this.options.networkAddress).catch((e) => this.handleCriticalError(e));
    }
    this.logger?.info(
      `Task Executor has started using subnet ${this.options.subnetTag}, network: ${this.options.payment?.network}, driver: ${this.options.payment?.driver}`
    );
  }

  async end() {
    await this.marketService.end();
    await this.agreementPoolService.end();
    await this.taskService.end();
    await this.paymentService.end();
    await this.networkService.end();
    this.storageProvider?.close();
    this.logger?.info("Task Executor has been stopped");
  }

  beforeEach(worker: Worker) {
    this.initWorker = worker;
  }

  async run<OutputType = Result>(worker: Worker<undefined, OutputType>): Promise<OutputType | undefined> {
    return this.submitNewTask<undefined, OutputType>(worker);
  }

  map<InputType, OutputType>(
    data: Iterable<InputType>,
    worker: Worker<InputType, OutputType>
  ): AsyncIterable<OutputType | undefined> {
    const inputs = [...data];
    const featureResults = inputs.map((value) => this.submitNewTask<InputType, OutputType>(worker, value));
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
              await sleep(100, true);
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
    await Promise.all([...data].map((value) => this.submitNewTask<InputType, OutputType>(worker, value)));
  }

  private async createPackage(image_hash: string): Promise<Package> {
    return repo({ ...this.options, image_hash });
  }

  private async submitNewTask<InputType, OutputType>(
    worker: Worker<InputType, OutputType>,
    data?: InputType
  ): Promise<OutputType | undefined> {
    const task = new Task<InputType, OutputType>(worker, data, this.initWorker);
    this.taskQueue.addToEnd(task);
    let timeout = false;
    const timeoutId = setTimeout(() => (timeout = true), this.options.timeout);
    while (!timeout) {
      if (task.isFinished()) {
        clearTimeout(timeoutId);
        return task.getResults();
      }
      await sleep(2);
    }
  }

  private handleCriticalError(e: Error) {
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
