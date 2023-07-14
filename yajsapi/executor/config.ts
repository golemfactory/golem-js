import { ExecutorOptions } from "./executor.js";
import { Package, PackageOptions } from "../package/index.js";
import { ActivityOptions } from "../activity";
import { Logger, LogLevel, runtimeContextChecker, defaultLogger } from "../utils/index.js";

const DEFAULTS = Object.freeze({
  payment: { driver: "erc20", network: "goerli" },
  budget: 1.0,
  subnetTag: "public",
  logLevel: LogLevel.info,
  basePath: "http://127.0.0.1:7465",
  maxParallelTasks: 5,
  taskTimeout: 1000 * 60 * 5, // 5 min,
  maxTaskRetries: 3,
});

/**
 * @internal
 */
export class ExecutorConfig {
  readonly package?: Package | string;
  readonly maxParallelTasks: number;
  readonly taskTimeout: number;
  readonly budget: number;
  readonly subnetTag: string;
  readonly payment: { driver: string; network: string };
  readonly networkIp?: string;
  readonly packageOptions: Omit<PackageOptions, "imageHash" | "imageTag">;
  readonly logLevel: string;
  readonly yagnaOptions: { apiKey: string; basePath: string };
  readonly logger?: Logger;
  readonly eventTarget: EventTarget;
  readonly maxTaskRetries: number;
  readonly activityExecuteTimeout?: number;
  readonly isSubprocess: boolean;

  constructor(options: ExecutorOptions & ActivityOptions) {
    const processEnv = !runtimeContextChecker.isBrowser
      ? process
      : {
          env: {
            YAGNA_APPKEY: null,
            YAGNA_API_URL: null,
            YAGNA_SUBNET: null,
          },
        };
    Object.keys(options).forEach((key) => (this[key] = options[key]));
    this.activityExecuteTimeout = options.activityExecuteTimeout || options.taskTimeout;
    const apiKey = options?.yagnaOptions?.apiKey || processEnv.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    this.yagnaOptions = {
      apiKey,
      basePath: options.yagnaOptions?.basePath || processEnv.env.YAGNA_API_URL || DEFAULTS.basePath,
    };
    this.package = options.package;
    this.packageOptions = {
      engine: options.engine,
      minMemGib: options.minMemGib,
      minStorageGib: options.minStorageGib,
      minCpuThreads: options.minCpuThreads,
      capabilities: options.capabilities,
      manifest: options.manifest,
      manifestSig: options.manifestSig,
      manifestSigAlgorithm: options.manifestSigAlgorithm,
      manifestCert: options.manifestCert,
    };
    this.budget = options.budget || DEFAULTS.budget;
    this.maxParallelTasks = options.maxParallelTasks || DEFAULTS.maxParallelTasks;
    this.taskTimeout = options.taskTimeout || DEFAULTS.taskTimeout;
    this.subnetTag = options.subnetTag || processEnv.env?.YAGNA_SUBNET || DEFAULTS.subnetTag;
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
    };
    this.logger = options.logger || (!runtimeContextChecker.isBrowser ? defaultLogger() : undefined);
    this.logLevel = options.logLevel || DEFAULTS.logLevel;
    this.logger?.setLevel && this.logger?.setLevel(this.logLevel);
    this.eventTarget = options.eventTarget || new EventTarget();
    this.maxTaskRetries = options.maxTaskRetries || DEFAULTS.maxTaskRetries;
    this.isSubprocess = options.isSubprocess ?? false;
  }
}
