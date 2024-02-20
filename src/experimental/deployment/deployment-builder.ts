import { GolemDeployment } from "./deployment";
import { LocalDeployment } from "./local-deployment";
import { GolemAPISpec, GolemDeploymentBuilderOptions, GolemNetworkSpec, GolemServiceSpec } from "./deployment-types";
import { GolemError } from "../../error/golem-error";
import { defaultLogger, Logger } from "../../utils";

// type GolemNetworkSpec = object;

// TO
export class GolemDeploymentBuilder {
  private readonly services = new Map<string, GolemServiceSpec>();
  private readonly networks = new Map<string, GolemNetworkSpec>();
  private readonly networkServices = new Map<string, Set<string>>();

  private readonly api: GolemAPISpec;
  private readonly logger: Logger;

  constructor(options?: GolemDeploymentBuilderOptions) {
    if (options?.api) {
      this.api = options.api;
    } else {
      this.api = this.getApiFromEnv();
    }

    this.logger = options?.logger ?? defaultLogger("deployment-builder");
  }

  /**
   * FIXME: Define ENV reading behaviour
   * @private
   */
  private getApiFromEnv(): GolemAPISpec {
    const key = process.env.GOLEM_API_KEY ?? process.env.YAGNA_APPKEY;
    const url = process.env.GOLEM_API_URL ?? process.env.YAGNA_URL;

    if (!key) {
      throw new GolemError("Neither GOLEM_API_KEY nor YAGNA_APPKEY are defined");
    }

    if (!url) {
      throw new GolemError("Neither GOLEM_API_URL nor YAGNA_URL are defined");
    }

    return {
      key,
      url,
    };
  }

  createService(name: string, serviceSpec: GolemServiceSpec): this {
    this.services.set(name, serviceSpec);
    return this;
  }

  createNetwork(name: string, networkSpec: GolemNetworkSpec): this {
    this.networks.set(name, networkSpec);
    return this;
  }

  addServiceToNetwork(serviceName: string, networkName: string): this {
    const services = this.networkServices.get(networkName) ?? new Set<string>();
    services.add(serviceName);
    this.networkServices.set(networkName, services);
    return this;
  }

  // TODO: Add default market options

  build(): GolemDeployment {
    const dep = new LocalDeployment();

    return dep;
  }
}
