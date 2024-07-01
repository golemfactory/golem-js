import { BaseConfig } from "./base-config";
import * as EnvUtils from "../../../shared/utils/env";

export interface BasicDemandDirectorConfigOptions {
  /** Determines which subnet tag should be used for the offer/demand matching */
  subnetTag: string;
}

export class BasicDemandDirectorConfig extends BaseConfig implements BasicDemandDirectorConfigOptions {
  public readonly subnetTag: string = EnvUtils.getYagnaSubnet();

  constructor(options?: Partial<BasicDemandDirectorConfigOptions>) {
    super();

    if (options?.subnetTag) {
      this.subnetTag = options.subnetTag;
    }
  }
}
