import { Package } from "../package";
import { WorkContext } from "./work_context";
import { Executor, vm } from "./";
import { Result } from "../activity";
import { MarketStrategy } from "./strategy";
import { Callable, sleep } from "../utils";
import * as events from "./events";
import { Logger } from "../utils/logger";

type ExecutorOptions = {
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
  event_consumer?: Callable<[events.YaEvent], void>;
  network_address?: string;
  engine?: string;
  min_mem_gib?: number;
  min_storage_gib?: number;
  min_cpu_threads?: number;
  cores?: number;
  capabilities?: string[];
  logger?: Logger;
  logLevel?: string;
  credentials?: { apiKey?: string; apiUrl?: string };
};

type ExecutorOptionsMixin = string | ExecutorOptions;

export type Worker<InputType = unknown, OutputType = unknown> = (
  ctx: WorkContext,
  data: InputType
) => Promise<OutputType | void>;

const DEFAULT_OPTIONS = {
  max_workers: 5,
  budget: "1.0",
  strategy: null,
  subnet_tag: "devnet-beta",
  payment_driver: "erc20",
  payment_network: "rinkeby",
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
    for (const key in typeof options === "object" ? { ...DEFAULT_OPTIONS, ...options } : DEFAULT_OPTIONS) {
      this.options[key] = options[key] ?? process.env?.[key.toUpperCase()] ?? DEFAULT_OPTIONS[key];
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
    this.executor = new Executor({ ...this.options, task_package });
    await this.executor.ready();
    this.executor.init().catch((error) => {
      throw error;
    });
  }

  beforeEach(worker: Worker) {
    if (!this.executor) throw new Error("Task executor not initialized");
    this.executor.submit_before(worker);
  }

  async run<OutputType = Result>(worker: Worker<undefined, OutputType>): Promise<OutputType> {
    if (!this.executor) throw new Error("Task executor is not initialized");
    return this.executor.submit_new_task<undefined, OutputType>(worker);
  }

  map<InputType, OutputType>(
    data: Iterable<InputType>,
    worker: Worker<InputType, OutputType>
  ): AsyncIterable<OutputType | undefined> {
    if (!this.executor) throw new Error("Task executor is not initialized");
    const inputs = [...data];
    const featureResults = inputs.map((value) => this.executor!.submit_new_task<InputType, OutputType>(worker, value));
    const results: OutputType[] = [];
    let resultsCount = 0;
    featureResults.forEach((featureResult) => featureResult.then((res) => results.push(res)));
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
    await Promise.all([...data].map((value) => this.executor!.submit_new_task<InputType, OutputType>(worker, value)));
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
