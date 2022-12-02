import { ExecutorOptions } from "./executor";
import { Package, repo } from "../package";
import { MarketStrategy } from "../market";
import { Logger } from "../utils";
import { DefaultMarketStrategy } from "../market/strategy";

const DEFAULTS = {
  maxWorkers: 5,
  budget: 1.0,
  subnetTag: "devnet-beta",
  payment: { driver: "erc20", network: "rinkeby" },
  timeout: 1000 * 60 * 15, // 15 min,
  logLevel: "info",
  basePath: "http://127.0.0.1:7465",
};

export class ExecutorConfig {
  readonly package: Package | string;
  readonly maxWorkers: number;
  readonly timeout: number;
  readonly budget: number;
  readonly strategy?: MarketStrategy;
  readonly subnetTag: string;
  readonly payment: { driver: string; network: string };
  readonly networkAddress?: string;
  readonly packageOptions: {
    engine?: string;
    minMemGib?: number;
    minStorageGib?: number;
    minCpuThreads?: number;
    cores?: number;
    capabilities?: string[];
  };
  readonly logger?: Logger;
  readonly logLevel: string;
  readonly yagnaOptions: { apiKey: string; basePath: string };

  constructor(options: ExecutorOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    this.yagnaOptions = {
      apiKey,
      basePath: options.yagnaOptions?.basePath || process.env.YAGNA_BASEPATH || DEFAULTS.basePath,
    };
    this.package = options.package;
    this.budget = options.budget || DEFAULTS.budget;
    this.maxWorkers = options.maxWorkers || DEFAULTS.maxWorkers;
    this.timeout = options.timeout || DEFAULTS.timeout;
    this.subnetTag = options.subnetTag || DEFAULTS.subnetTag;
    this.payment = {
      driver: options.payment?.driver || DEFAULTS.payment.driver,
      network: options.payment?.network || DEFAULTS.payment.network,
    };
    this.networkAddress = options.networkAddress;
    this.packageOptions = {
      engine: options.engine,
      minMemGib: options.minMemGib,
      minStorageGib: options.minStorageGib,
      minCpuThreads: options.minCpuThreads,
      capabilities: options.capabilities,
    };
    this.logger = options.logger;
    this.logLevel = options.logLevel || DEFAULTS.logLevel;
  }
}
