import { Logger } from "../utils";
import { PackageOptions } from "./package";
import { GolemError } from "../error/golem-error";

/**
 * @internal
 */
export const DEFAULTS = Object.freeze({
  payment: { driver: "erc20", network: "goerli" },
  engine: "vm",
  minMemGib: 0.5,
  minStorageGib: 2,
  minCpuThreads: 1,
  minCpuCores: 1,
  capabilities: [],
});

/**
 * @internal
 */
export enum PackageFormat {
  Unknown = "",
  GVMKitSquash = "gvmkit-squash",
}

/**
 * @internal
 */

// ? Isn't it just a merge of object literals and no need to have a class here
export class PackageConfig {
  readonly packageFormat: string;
  readonly imageHash?: string;
  readonly imageTag?: string;
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
    if (!options.imageHash && !options.manifest && !options.imageTag) {
      throw new GolemError("You must define a package or manifest option");
    }

    this.packageFormat = PackageFormat.GVMKitSquash;
    this.imageHash = options.imageHash;
    this.imageTag = options.imageTag;
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
