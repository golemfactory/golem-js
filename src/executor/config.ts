import { ExecutorOptions } from "./executor";
import { Package, PackageOptions } from "../package";
import { ActivityOptions } from "../activity";
import { GolemConfigError } from "../error/golem-error";
import { Logger, runtimeContextChecker, defaultLogger, nullLogger } from "../utils";

const DEFAULTS = Object.freeze({
  payment: { driver: "erc20", network: "holesky" },
  budget: 1.0,
  subnetTag: "public",
  basePath: "http://127.0.0.1:7465",
  maxParallelTasks: 5,
  taskTimeout: 1000 * 60 * 5, // 5 min,
  maxTaskRetries: 3,
  enableLogging: true,
  startupTimeout: 1000 * 90, // 90 sec
  exitOnNoProposals: false,
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
  readonly networkIp?: string;
  readonly packageOptions: Omit<PackageOptions, "imageHash" | "imageTag">;
  readonly yagnaOptions: { apiKey: string; basePath: string };
  readonly logger: Logger;
  readonly eventTarget: EventTarget;
  readonly maxTaskRetries: number;
  readonly startupTimeout: number;
  readonly exitOnNoProposals: boolean;

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
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore FIXME: this weirdness may not be needed anymore?
    Object.keys(options).forEach((key) => (this[key] = options[key]));
    const apiKey = options?.yagnaOptions?.apiKey || processEnv.env.YAGNA_APPKEY;
    if (!apiKey) {
      throw new GolemConfigError("Api key not defined");
    }
    if (options.maxTaskRetries && options.maxTaskRetries < 0) {
      throw new GolemConfigError("The maxTaskRetries parameter cannot be less than zero");
    }
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
      minCpuCores: options.minCpuCores,
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
    this.networkIp = options.networkIp;
    this.logger = (() => {
      const isLoggingEnabled = options.enableLogging ?? DEFAULTS.enableLogging;
      if (!isLoggingEnabled) return nullLogger();
      if (options.logger) return options.logger.child("task-executor");
      return defaultLogger("task-executor");
    })();
    this.eventTarget = options.eventTarget || new EventTarget();
    this.maxTaskRetries = options.maxTaskRetries ?? DEFAULTS.maxTaskRetries;
    this.startupTimeout = options.startupTimeout ?? DEFAULTS.startupTimeout;
    this.exitOnNoProposals = options.exitOnNoProposals ?? DEFAULTS.exitOnNoProposals;
  }
}
