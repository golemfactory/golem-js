import { ExecutorOptions } from "./executor.js";
import { Package } from "../package/index.js";
import { MarketStrategy } from "../market/index.js";
import { Logger, runtimeContextChecker, winstonLogger } from "../utils/index.js";

const DEFAULTS = {
  budget: 1.0,
  subnetTag: "public",
  logLevel: "info",
  basePath: "http://127.0.0.1:7465",
  payment: { driver: "erc20", network: "rinkeby" },
  maxParallelTasks: 5,
  taskTimeout: 1000 * 60 * 3, // 3 min,
};

/**
 * @internal
 */
export class ExecutorConfig {
  readonly package: Package | string;
  readonly maxParallelTasks: number;
  readonly taskTimeout: number;
  readonly budget: number;
  readonly strategy?: MarketStrategy;
  readonly subnetTag: string;
  readonly payment: { driver: string; network: string };
  readonly networkIp?: string;
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
    Object.keys(options).forEach((key) => (this[key] = options[key]));
    this["activityExecuteTimeout"] = options.taskTimeout;
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    this.yagnaOptions = {
      apiKey,
      basePath: options.yagnaOptions?.basePath || process.env.YAGNA_API_URL || DEFAULTS.basePath,
    };
    this.package = options.package;
    this.budget = options.budget || DEFAULTS.budget;
    this.maxParallelTasks = options.maxParallelTasks || DEFAULTS.maxParallelTasks;
    this.taskTimeout = options.taskTimeout || DEFAULTS.taskTimeout;
    this.subnetTag = options.subnetTag || process.env?.YAGNA_SUBNET || DEFAULTS.subnetTag;
    this.payment = {
      driver: options.payment?.driver || DEFAULTS.payment.driver,
      network: options.payment?.network || DEFAULTS.payment.network,
    };
    this.networkIp = options.networkIp;
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
