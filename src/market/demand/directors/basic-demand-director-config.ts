import { BaseConfig } from "./base-config";
import { GolemConfigError } from "../../../shared/error/golem-error";
import * as EnvUtils from "../../../shared/utils/env";

export interface BasicDemandDirectorConfigOptions {
  expirationSec: number;
  subnetTag: string;
}

export class BasicDemandDirectorConfig extends BaseConfig implements BasicDemandDirectorConfigOptions {
  public readonly expirationSec = 30 * 60; // 30 minutes
  public readonly subnetTag: string = EnvUtils.getYagnaSubnet();

  constructor(options?: Partial<BasicDemandDirectorConfigOptions>) {
    super();

    if (options?.expirationSec) {
      this.expirationSec = options.expirationSec;
    }
    if (options?.subnetTag) {
      this.subnetTag = options.subnetTag;
    }

    if (!this.isPositiveInt(this.expirationSec)) {
      throw new GolemConfigError("The demand expiration time has to be a positive integer");
    }
  }
}
