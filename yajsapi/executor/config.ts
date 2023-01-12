import { ExecutorOptions } from "./executor";
import { Package } from "../package";
import { MarketStrategy } from "../market";
import { Logger, runtimeContextChecker, winstonLogger } from "../utils";

const DEFAULTS = {
  maxParallelTasks: 5,
  budget: 1.0,
  subnetTag: "public",
  payment: { driver: "erc20", network: "rinkeby" },
  timeout: 1000 * 60 * 3, // 3 min,
  logLevel: "info",
  basePath: "http://127.0.0.1:7465",
};

export class ExecutorConfig {
  readonly package: Package | string;
  readonly maxParallelTasks: number;
  readonly timeout: number;
  readonly budget: number;
  readonly strategy?: MarketStrategy;
  readonly subnetTag: string;
  readonly payment: { driver: string; network: string };
  readonly networkAddress?: string;
  readonly packageOptions: {
    engine?: string;
    repoUrl?: string;
    minMemGib?: number;
    minStorageGib?: number;
    minCpuThreads?: number;
    cores?: number;
    capabilities?: string[];
  };
  readonly logLevel: string;
  readonly yagnaOptions: { apiKey: string; basePath: string };
  readonly logger?: Logger;
  readonly eventTarget: EventTarget;

  constructor(options: ExecutorOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    this.yagnaOptions = {
      apiKey,
      basePath: options.yagnaOptions?.basePath || process.env.YAGNA_API_URL || DEFAULTS.basePath,
    };
    this.package = options.package;
    this.budget = options.budget || DEFAULTS.budget;
    this.maxParallelTasks = options.maxParallelTasks || DEFAULTS.maxParallelTasks;
    this.timeout = options.timeout || DEFAULTS.timeout;
    this.subnetTag = options.subnetTag || process.env?.YAGNA_SUBNET || DEFAULTS.subnetTag;
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
      repoUrl: options.repoUrl,
    };
    this.logger = options.logger || (!runtimeContextChecker.isBrowser ? winstonLogger : undefined);
    this.logLevel = options.logLevel || DEFAULTS.logLevel;
    this.logger?.setLevel && this.logger?.setLevel(this.logLevel);
    this.eventTarget = options.eventTarget || new EventTarget();
  }
}
