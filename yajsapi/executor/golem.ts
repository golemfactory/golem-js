import { Package, RepoOpts } from "../package";
import { WorkContextNew } from "./work_context";
import { Executor, ExecutorOpts, vm } from "./";
import { Result } from "../activity";
import { MarketStrategy } from "./strategy";
import { Callable } from "../utils";
import * as events from "./events";

type GolemOptions = {
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
};

type GolemOptionsMixin = string | GolemOptions;

export type Worker<InputType = unknown, OutputType = unknown> = (
  ctx: WorkContextNew,
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

export class Golem {
  private oldExecutor?: Executor;
  private options: GolemOptions;
  private image_hash?: string;

  constructor(options: GolemOptionsMixin) {
    if (typeof options === "string") {
      this.image_hash = options;
    }
    this.options = {} as GolemOptions;
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
    this.oldExecutor = new Executor({ ...this.options, task_package });
    await this.oldExecutor.ready();
    this.oldExecutor.init().catch((error) => {
      throw error;
    });
  }

  beforeEach(worker: Worker) {
    this.oldExecutor!.submit_new_run_before(worker);
  }

  async run<OutputType = Result>(worker: Worker): Promise<OutputType> {
    return this.oldExecutor!.submit_new_run<OutputType>(worker);
  }

  map<InputType, OutputType>(
    data: Iterable<InputType>,
    worker: Worker<InputType, OutputType>
  ): AsyncIterable<OutputType | undefined> {
    return this.oldExecutor!.submit_new_map<InputType, OutputType>(data, worker);
  }

  forEach<InputType, OutputType>(data: Iterable<InputType>, worker: Worker<InputType, OutputType>): Promise<void> {
    return this.oldExecutor!.submit_new_foreach<InputType, OutputType>(data, worker);
  }

  async end() {
    await this.oldExecutor?.done();
  }

  private async createPackage(image_hash: string): Promise<Package> {
    return vm.repo({ ...this.options, image_hash });
  }
}

export async function createGolem(options: GolemOptionsMixin) {
  const golem = new Golem(options);
  await golem.init();
  return golem;
}
