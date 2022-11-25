// eslint-disable-next-line @typescript-eslint/no-var-requires
import { GftpStorageProvider } from "../storage/gftp_provider";

// const log = require("why-is-node-running"); // should be your first require
import { Package, repo } from "../package";
import { MarketService, MarketStrategy } from "../market";
import { AgreementPoolService } from "../agreement";
import { Task, TaskQueue, TaskService } from "../task";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { WorkContext } from "../work";
import { Result } from "../core/activity";
import { sleep, Logger, runtimeContextChecker, winstonLogger } from "../utils";
import { EventBus } from "../events/event_bus";
import { StorageProvider } from "../storage/provider";
import { DEFAULT_EXECUTOR_OPTIONS, DEFAULT_YAGNA_API_URL } from "./defaults";
import { AgreementConfigContainer } from "../agreement/agreement_config_container";

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
  yagnaOptions?: { apiKey?: string; apiUrl?: string };
};

export type ExecutorOptionsMixin = string | ExecutorOptions;

export type YagnaOptions = {
  apiKey: string;
  basePath: string;
};

export type Worker<InputType, OutputType> = (ctx: WorkContext, data: InputType) => Promise<OutputType | void>;

export class TaskExecutor {
  private readonly options: ExecutorOptions;
  private readonly yagnaOptions: YagnaOptions;
  private readonly image_hash?: string;
  private marketService: MarketService;
  private agreementPoolService: AgreementPoolService;
  private taskService: TaskService;
  private paymentService: PaymentService;
  private networkService: NetworkService;
  private initWorker?: Worker<unknown, unknown>;
  private taskQueue: TaskQueue<Task<any, any>>;
  private eventBus: EventBus;
  private storageProvider?: StorageProvider;
  private logger?: Logger;

  constructor(options: ExecutorOptionsMixin) {
    if (typeof options === "string") {
      this.image_hash = options;
    }
    this.options = {} as ExecutorOptions;
    for (const key in typeof options === "object"
      ? { ...DEFAULT_EXECUTOR_OPTIONS, ...options }
      : DEFAULT_EXECUTOR_OPTIONS) {
      this.options[key] = options[key] ?? process.env?.[key.toUpperCase()] ?? DEFAULT_EXECUTOR_OPTIONS[key];
    }
    this.options.payment = {
      driver: (options as ExecutorOptions)?.payment?.driver || DEFAULT_EXECUTOR_OPTIONS.payment.driver,
      network: (options as ExecutorOptions)?.payment?.network || DEFAULT_EXECUTOR_OPTIONS.payment.network,
    };
    this.yagnaOptions = {
      apiKey: options?.["yagnaOptions"]?.["apiKey"] || process?.env?.["YAGNA_APPKEY"],
      basePath: options?.["yagnaOptions"]?.["basePath"] || process?.env?.["YAGNA_URL"] || DEFAULT_YAGNA_API_URL,
    };
    this.logger = this.options.logger;
    if (!this.options.logger && !runtimeContextChecker.isBrowser) this.logger = winstonLogger;
    this.logger?.setLevel && this.logger?.setLevel(this.options.logLevel || "info");
    this.eventBus = new EventBus();
    this.taskQueue = new TaskQueue<Task<unknown, unknown>>();
    const agreementContainer = new AgreementConfigContainer(
      { yagnaOptions: this.yagnaOptions },
      this.eventBus,
      this.logger
    );
    this.agreementPoolService = new AgreementPoolService(agreementContainer);
    this.networkService = new NetworkService(this.yagnaOptions, this.eventBus, this.logger);
    this.paymentService = new PaymentService(this.yagnaOptions, this.eventBus, this.logger);
    this.marketService = new MarketService(
      this.paymentService,
      this.agreementPoolService,
      this.logger,
      {
        budget: this.options.budget!,
        payment: { driver: this.options.payment!.driver!, network: this.options.payment!.network! },
        subnetTag: this.options.subnetTag!,
        timeout: this.options.timeout!,
        yagnaOptions: this.yagnaOptions,
      },
      this.options.strategy
    );
    this.storageProvider = new GftpStorageProvider();
    this.taskService = new TaskService(
      this.yagnaOptions,
      this.taskQueue,
      this.eventBus,
      this.agreementPoolService,
      this.paymentService,
      this.storageProvider,
      this.networkService,
      this.logger
    );
  }

  async init() {
    let taskPackage;
    if (this.image_hash) {
      taskPackage = await this.createPackage(this.image_hash).catch((e) => this.handleCriticalError(e));
    } else if (typeof this.options.package === "string") {
      taskPackage = await this.createPackage(this.options.package).catch((e) => this.handleCriticalError(e));
    } else {
      taskPackage = this.options.package;
    }
    this.logger?.debug("Initializing task executor services...");
    this.marketService.run(taskPackage).catch((e) => this.handleCriticalError(e));
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
    // log();
  }

  beforeEach(worker: Worker<unknown, unknown>) {
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
