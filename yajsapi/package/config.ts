import { Logger } from "../utils/index.js";
import { PackageOptions } from "./package.js";

/**
 * @internal
 */
export const DEFAULTS = {
  engine: "vm",
  minMemGib: 0.5,
  minStorageGib: 2,
  minCpuThreads: 1,
  minCpuCores: 1,
  capabilities: [],
};

/**
 * @internal
 */
export enum PackageFormat {
  UNKNOWN = "",
  GVMKIT_SQUASH = "gvmkit-squash",
}

/**
 * @internal
 */
export class PackageConfig {
  readonly packageFormat: string;
  readonly imageHash?: string;
  readonly repoUrl?: string;
  readonly engine: string;
  readonly minMemGib: number;
  readonly minStorageGib: number;
  readonly minCpuThreads: number;
  readonly minCpuCores: number;
  readonly capabilities: string[];
  readonly manifest?: string;
  readonly manifestSig?: string;
  readonly manifestSigAlgorithm?: string;
  readonly manifestCert?: string;
  readonly logger?: Logger;

  constructor(options: PackageOptions) {
    if (!options.imageHash && !options.manifest) throw new Error("You must define a package or manifest option");
    this.packageFormat = PackageFormat.GVMKIT_SQUASH;
    this.imageHash = options.imageHash;
    this.repoUrl = options.repoUrl;
    this.engine = options.engine || DEFAULTS.engine;
    this.minMemGib = options.minMemGib || DEFAULTS.minMemGib;
    this.minStorageGib = options.minStorageGib || DEFAULTS.minStorageGib;
    this.minCpuThreads = options.minCpuThreads || DEFAULTS.minCpuThreads;
    this.minCpuCores = options.minCpuCores || DEFAULTS.minCpuCores;
    this.capabilities = options.capabilities || DEFAULTS.capabilities;
    this.manifest = options.manifest;
    this.manifestSig = options.manifestSig;
    this.manifestSigAlgorithm = options.manifestSigAlgorithm;
    this.manifestCert = options.manifestCert;
    this.logger = options.logger;
  }
}
