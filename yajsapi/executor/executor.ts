import { Package, repo } from "../package";
import { MarketService, MarketStrategy } from "../market";
import { AgreementPoolService } from "../agreement";
import { Task, TaskQueue, TaskService } from "../task";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { WorkContext } from "../work";
import { Result } from "../activity";
import { sleep, Logger, runtimeContextChecker, winstonLogger } from "../utils";
import { EventBus } from "../events/event_bus";
import { StorageProvider } from "../storage/provider";

export type ExecutorOptions = {
  package: string | Package;
  max_workers?: number;
  timeout?: number | string;
  budget?: string;
  strategy?: MarketStrategy;
  subnet_tag?: string;
  driver?: string;
  network?: string;
  payment_driver?: string;
  payment_network?: string;
  event_consumer?: "todo";
  network_address?: string;
  engine?: string;
  min_mem_gib?: number;
  min_storage_gib?: number;
  min_cpu_threads?: number;
  cores?: number;
  capabilities?: string[];
  logger?: Logger;
  logLevel?: string;
  yagnaOptions?: { apiKey?: string; apiUrl?: string };
};

export type ExecutorOptionsMixin = string | ExecutorOptions;

export type YagnaOptions = {
  apiKey: string;
  apiUrl: string;
};

export type Worker<InputType, OutputType> = (ctx: WorkContext, data: InputType) => Promise<OutputType | void>;

const DEFAULT_OPTIONS = {
  max_workers: 5,
  budget: "1.0",
  strategy: null,
  subnet_tag: "devnet-beta",
  payment_driver: "erc20",
  payment_network: "rinkeby",
};

const DEFAULT_YAGNA_API_URL = "http://127.0.0.1:7465";

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
    for (const key in typeof options === "object" ? { ...DEFAULT_OPTIONS, ...options } : DEFAULT_OPTIONS) {
      this.options[key] = options[key] ?? process.env?.[key.toUpperCase()] ?? DEFAULT_OPTIONS[key];
    }
    this.yagnaOptions = {
      apiKey: options?.["yagnaOptions"]?.["apiKey"] || process?.env?.["YAGNA_APPKEY"],
      apiUrl: options?.["yagnaOptions"]?.["apiUrl"] || process?.env?.["YAGNA_URL"] || DEFAULT_YAGNA_API_URL,
    };
    this.logger = this.options.logger;
    if (!this.options.logger && !runtimeContextChecker.isBrowser) this.logger = winstonLogger;
    this.logger?.setLevel && this.logger?.setLevel(this.options.logLevel || "info");
    this.eventBus = new EventBus();
    this.taskQueue = new TaskQueue<Task<unknown, unknown>>();
    this.marketService = new MarketService(this.yagnaOptions, this.eventBus, this.logger);
    this.agreementPoolService = new AgreementPoolService(this.yagnaOptions, this.eventBus, this.logger);
    this.networkService = new NetworkService(this.yagnaOptions, this.eventBus, this.logger);
    this.paymentService = new PaymentService(this.yagnaOptions, this.eventBus, this.logger);
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
      taskPackage = await this.createPackage(this.image_hash);
    } else if (typeof this.options.package === "string") {
      taskPackage = await this.createPackage(this.options.package);
    } else {
      taskPackage = this.options.package;
    }

    this.marketService.run(taskPackage);
    this.agreementPoolService.run();
    this.paymentService.run();
    this.taskService.run();
    if (this.options.network_address) {
      this.networkService.run(this.options.network_address);
    }
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

  async end() {
    await this.marketService.end();
    await this.agreementPoolService.end();
    await this.taskService.end();
    await this.paymentService.end();
    await this.networkService.end();
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
    // todo: timeout to config..?
    setTimeout(() => (timeout = true), 20000);
    while (!timeout) {
      if (task.isFinished()) return task.getResults();
      await sleep(2);
    }
  }
}

export async function createExecutor(options: ExecutorOptionsMixin) {
  const executor = new TaskExecutor(options);
  await executor.init();
  return executor;
}
