import { MarketStrategy } from "./strategy";
import { Package } from "../package";
import { WorkContext } from "./work_context";
import { Executor, Task } from "./";
import { Result } from "../activity";

type GolemOptions =
  | string
  | {
      package: string | Package;
      max_workers?: number;
      timeout?: number;
      budget?: number;
      strategy?: MarketStrategy;
      subnet_tag?: string;
      driver?: string;
      network?: string;
      payment_driver?: string;
      payment_network?: string;
      event_consumer?: string;
      network_address?: string;
    };

export type Worker<InputType = unknown, OutputType = string | void> = (
  ctx: WorkContext,
  data: InputType
) => Promise<OutputType>;

const DEFAULT_OPTIONS = {
  max_workers: 5,
  timeout: 0,
  budget: 0,
  strategy: null,
  subnet_tag: "devnet-beta",
  driver: "erc20",
  network: null,
  payment_driver: "erc20",
  payment_network: "rinkeby",
  event_consumer: null,
  network_address: "192.169.0.0/24",
};

export class Golem {
  private package: Package;
  private oldExecutor: Executor;
  private options;

  constructor(options: GolemOptions) {
    this.package = typeof options === "string" ? this.createPackage(options) : (options.package as Package);
    for (const key in DEFAULT_OPTIONS) {
      this.options[key] = options[key] ?? process.env?.[key.toUpperCase()] ?? DEFAULT_OPTIONS[key];
    }
    this.oldExecutor = new Executor(this.options);
  }

  private async init() {
    await this.oldExecutor.ready();
  }

  async beforeEach(worker: Worker) {
    // todo
  }
  async run<OutputType>(worker: Worker): Promise<OutputType> {
    return new Promise(() => ({} as OutputType));
  }

  map<InputType, OutputType>(
    data: Iterable<InputType>,
    worker: Worker<InputType, OutputType>
  ): AsyncIterable<OutputType> {
    return this.oldExecutor.submit_new<InputType, OutputType>(worker, data);
  }
  async end() {
    await this.oldExecutor.done();
  }

  private createPackage(image_hash: string): Package {
    // todo
    return new Package();
  }
}
