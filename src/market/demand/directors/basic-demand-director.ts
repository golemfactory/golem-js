import { DemandBodyBuilder } from "../demand-body-builder";
import { IDemandDirector } from "../../market.module";
import { BasicDemandDirectorConfig } from "./basic-demand-director-config";

export class BasicDemandDirector implements IDemandDirector {
  constructor(private config: BasicDemandDirectorConfig = new BasicDemandDirectorConfig()) {}

  apply(builder: DemandBodyBuilder) {
    builder
      .addProperty("golem.srv.caps.multi-activity", true)
      .addProperty("golem.srv.comp.expiration", Date.now() + this.config.expirationSec * 1000)
      .addProperty("golem.node.debug.subnet", this.config.subnetTag);

    builder
      .addConstraint("golem.com.pricing.model", "linear")
      .addConstraint("golem.node.debug.subnet", this.config.subnetTag);
  }
}
