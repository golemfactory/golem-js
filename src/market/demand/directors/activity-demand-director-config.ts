import { ActivityDemandDirectorConfigOptions } from "../options";
import { GolemConfigError } from "../../../shared/error/golem-error";

export enum PackageFormat {
  GVMKitSquash = "gvmkit-squash",
}

export class ActivityDemandDirectorConfig {
  readonly packageFormat: string = PackageFormat.GVMKitSquash;
  readonly engine: string = "vm";
  readonly minMemGib: number = 0.5;
  readonly minStorageGib: number = 2;
  readonly minCpuThreads: number = 1;
  readonly minCpuCores: number = 1;
  readonly capabilities: string[] = [];
  readonly manifest?: string;
  readonly manifestSig?: string;
  readonly manifestSigAlgorithm?: string;
  readonly manifestCert?: string;

  readonly imageHash?: string;
  readonly imageTag?: string;
  readonly imageUrl?: string;

  constructor(options?: Partial<ActivityDemandDirectorConfigOptions>) {
    if (options) {
      Object.assign(this, options);
    }

    if (!this.imageHash && !this.manifest && !this.imageTag && !this.imageUrl) {
      throw new GolemConfigError("You must define a package or manifest option");
    }

    if (this.imageUrl && !this.imageHash) {
      throw new GolemConfigError("If you provide an imageUrl, you must also provide it's SHA3-224 hash in imageHash");
    }
  }
}
