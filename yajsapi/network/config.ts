import { NetworkOptions } from "./network.js";
import { RequestorApi } from "ya-ts-client/dist/ya-net/api.js";
import { Configuration } from "ya-ts-client/dist/ya-payment/index.js";
import { Agent } from "http";
import { EnvUtils, Logger } from "../utils/index.js";

const DEFAULTS = {
  networkIp: "192.168.0.0/24",
};

/**
 * @internal
 */
export class NetworkConfig {
  public readonly api: RequestorApi;
  public readonly mask?: string;
  public readonly ip: string;
  public readonly ownerId: string;
  public readonly ownerIp?: string;
  public readonly gateway?: string;
  public readonly logger?: Logger;
  public readonly apiUrl: string;
  public readonly httpAgent: Agent;

  constructor(options: NetworkOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || EnvUtils.getYagnaAppKey();
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || EnvUtils.getYagnaApiUrl();
    this.apiUrl = `${basePath}/net-api/v1`;
    this.httpAgent = new Agent({ keepAlive: true });
    const apiConfig = new Configuration({
      apiKey,
      basePath: this.apiUrl,
      accessToken: apiKey,
      baseOptions: { httpAgent: this.httpAgent },
    });
    this.api = new RequestorApi(apiConfig);
    this.ip = options?.networkIp || DEFAULTS.networkIp;
    this.mask = options?.networkMask;
    this.ownerId = options.networkOwnerId;
    this.ownerIp = options?.networkOwnerIp;
    this.gateway = options?.networkGateway;
    this.logger = options?.logger;
  }
}
