import { BaseConfig } from "./base-config";
import { GolemConfigError } from "../../../shared/error/golem-error";

export interface BasicDemandDirectorConfigOptions {
  expirationSec: number;
  subnetTag: string;
}

export class BasicDemandDirectorConfig extends BaseConfig implements BasicDemandDirectorConfigOptions {
  public readonly expirationSec = 30 * 60; // 30 minutes
  public readonly subnetTag: string = "public";

  constructor(options?: Partial<BasicDemandDirectorConfigOptions>) {
    super();

    if (options) {
      Object.assign(this, options);
    }

    if (!this.isPositiveInt(this.expirationSec)) {
      throw new GolemConfigError("The demand expiration time has to be a positive integer");
    }
  }
}
