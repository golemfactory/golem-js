import { Package } from "../package";
import { WorkContext } from "./work_context";
import { Executor, vm } from "./";
import { Result } from "../activity";
import { MarketStrategy } from "./strategy";
import { Callable, sleep } from "../utils";
import * as events from "./events";

type ExecutorOptions = {
  package: string | Package;
  maxWorkers?: number;
  timeout?: number;
  budget?: string;
  strategy?: MarketStrategy;
  subnetTag?: string;
  driver?: string;
  network?: string;
  payment: { driver: string; network: string };
  eventConsumer?: Callable<[events.YaEvent], void>;
  networkAddress?: string;
  engine?: string;
  minMemGib?: number;
  minStorageGib?: number;
  minCpuThreads?: number;
  cores?: number;
  capabilities?: string[];
};

type ExecutorOptionsMixin = string | ExecutorOptions;

export type Worker<InputType = unknown, OutputType = unknown> = (
  ctx: WorkContext,
  data: InputType
) => Promise<OutputType | void>;

const DEFAULT_OPTIONS = {
  maxWorkers: 5,
  budget: "1.0",
  strategy: null,
  subnetTag: "devnet-beta",
  payment: { driver: "erc20", network: "rinkeby" },
};

export class TaskExecutor {
  private executor?: Executor;
  private options: ExecutorOptions;
  private image_hash?: string;

  constructor(options: ExecutorOptionsMixin) {
    if (typeof options === "string") {
      this.image_hash = options;
    }
    this.options = {} as ExecutorOptions;
    for (const key in typeof options === "object"
      ? { ...DEFAULT_OPTIONS, ...options }
      : DEFAULT_OPTIONS) {
      this.options[key] =
        options[key] ??
        process.env?.[key.toUpperCase()] ??
        DEFAULT_OPTIONS[key];
    }
  }

  async init() {
    let task_package;
    if (this.image_hash) {
      task_package = await this.createPackage(this.image_hash);
    } else if (typeof this.options.package === "string") {
      task_package = await this.createPackage(this.options.package);
    } else {
      task_package = this.options.package;
    }
    this.executor = new Executor({
      task_package: this.options.package,
      max_workers: this.options.maxWorkers,
      timeout: this.options.
      budget?: string; //number?
      strategy?: MarketStrategy;
      subnet_tag?: string;
      driver?: string; // @deprecated
      network?: string; // @deprecated
      payment_driver?: string;
      payment_network?: string;
      event_consumer?: Callable<[events.YaEvent], void>; //TODO not default event
      network_address?: string;
      task_package
    });
    await this.executor.ready();
    this.executor.init().catch((error) => {
      throw error;
    });
  }

  beforeEach(worker: Worker) {
    if (!this.executor) throw new Error("Task executor not initialized");
    this.executor.submit_before(worker);
  }

  async run<OutputType = Result>(
    worker: Worker<undefined, OutputType>
  ): Promise<OutputType> {
    if (!this.executor) throw new Error("Task executor is not initialized");
    return this.executor.submit_new_task<undefined, OutputType>(worker);
  }

  map<InputType, OutputType>(
    data: Iterable<InputType>,
    worker: Worker<InputType, OutputType>
  ): AsyncIterable<OutputType | undefined> {
    if (!this.executor) throw new Error("Task executor is not initialized");
    const inputs = [...data];
    const featureResults = inputs.map((value) =>
      this.executor!.submit_new_task<InputType, OutputType>(worker, value)
    );
    const results: OutputType[] = [];
    let resultsCount = 0;
    featureResults.forEach((featureResult) =>
      featureResult.then((res) => results.push(res))
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
    if (!this.executor) throw new Error("Task executor is not initialized");
    await Promise.all(
      [...data].map((value) =>
        this.executor!.submit_new_task<InputType, OutputType>(worker, value)
      )
    );
  }

  async end() {
    await this.executor?.done();
  }

  private async createPackage(image_hash: string): Promise<Package> {
    return vm.repo({ ...this.options, image_hash });
  }
}

export async function createExecutor(options: ExecutorOptionsMixin) {
  const executor = new TaskExecutor(options);
  await executor.init();
  return executor;
}
