import { MarketStrategy } from "./strategy";
import { Package } from "../package";
import { WorkContext } from "./work_context";
import { Executor, vm } from "./";
import { Result } from "../activity";

type GolemOptions = {
  package: string | Package;
  task_package: Package;
  max_workers?: number;
  timeout?: number;
  budget?: number;
  strategy?: MarketStrategy;
  subnet_tag?: string;
  payment_driver?: string;
  payment_network?: string;
  event_consumer?: string;
  network_address?: string;
};

type GolemOptionsMixin = string | GolemOptions;

export type Worker<InputType = unknown, OutputType = string | void> = (
  ctx: WorkContext,
  data: InputType
) => Promise<OutputType>;

const DEFAULT_OPTIONS = {
  max_workers: 5,
  budget: 1,
  strategy: null,
  subnet_tag: "devnet-beta",
  payment_driver: "erc20",
  payment_network: "rinkeby",
};

export class Golem {
  private oldExecutor: Executor | undefined;
  private options: GolemOptions = {};
  private image_hash?: string;

  constructor(options: GolemOptionsMixin) {
    if (typeof options === "string") {
      this.image_hash = options;
    }
    for (const key in DEFAULT_OPTIONS) {
      this.options[key] = options[key] ?? process.env?.[key.toUpperCase()] ?? DEFAULT_OPTIONS[key];
    }
  }

  async init() {
    if (this.image_hash) {
      this.options.task_package = await this.createPackage(this.image_hash);
    } else if (typeof this.options.package === "string") {
      this.options.task_package = await this.createPackage(this.options.package);
    } else {
      this.options.task_package = this.options.package;
    }
    this.oldExecutor = new Executor(this.options);
    await this.oldExecutor.ready();
    this.oldExecutor.init();
  }

  async beforeEach(worker: Worker) {
    // todo
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
  async end() {
    await this.oldExecutor?.done();
  }

  private async createPackage(image_hash: string): Promise<Package> {
    return vm.repo({ image_hash, min_mem_gib: 0.5, min_storage_gib: 2.0 });
  }
}
