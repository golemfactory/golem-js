import { WorkloadDemandDirectorConfigOptions } from "../options";
import { GolemConfigError } from "../../../shared/error/golem-error";
import { BaseConfig } from "./base-config";

export enum PackageFormat {
  GVMKitSquash = "gvmkit-squash",
}

type RequiredWorkloadDemandConfigOptions = {
  /** Number of seconds after which the agreement resulting from this demand will no longer be valid */
  expirationSec: number;
};

export class WorkloadDemandDirectorConfig extends BaseConfig {
  readonly packageFormat: string = PackageFormat.GVMKitSquash;
  readonly engine: string = "vm";
  readonly runtime = {
    name: "vm",
    version: undefined,
  };
  readonly minMemGib: number = 0.5;
  readonly minStorageGib: number = 2;
  readonly minCpuThreads: number = 1;
  readonly minCpuCores: number = 1;
  readonly capabilities: string[] = [];

  readonly expirationSec: number;

  readonly manifest?: string;
  readonly manifestSig?: string;
  readonly manifestSigAlgorithm?: string;
  readonly manifestCert?: string;
  readonly useHttps?: boolean = false;
  readonly imageHash?: string;
  readonly imageTag?: string;
  readonly imageUrl?: string;

  constructor(options: Partial<WorkloadDemandDirectorConfigOptions> & RequiredWorkloadDemandConfigOptions) {
    super();

    Object.assign(this, options);

    if (!this.runtime.name) {
      this.runtime.name = this.engine;
    }

    this.expirationSec = options.expirationSec;

    if (!this.imageHash && !this.manifest && !this.imageTag && !this.imageUrl) {
      throw new GolemConfigError("You must define a package or manifest option");
    }

    if (this.imageUrl && !this.imageHash) {
      throw new GolemConfigError("If you provide an imageUrl, you must also provide it's SHA3-224 hash in imageHash");
    }

    if (!this.isPositiveInt(this.expirationSec)) {
      throw new GolemConfigError("The expirationSec param has to be a positive integer");
    }

    if (options.engine && options.runtime) {
      throw new GolemConfigError(
        "The engine parameter is deprecated and cannot be used with the runtime parameter. Use the runtime option only",
      );
    }
  }
}
