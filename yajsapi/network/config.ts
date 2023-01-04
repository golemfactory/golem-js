import { NetworkOptions } from "./network";
import { RequestorApi } from "ya-ts-client/dist/ya-net/api";
import { Configuration } from "ya-ts-client/dist/ya-payment";
import { Logger } from "../utils";

const DEFAULTS = {
  basePath: "http://127.0.0.1:7465",
  ip: "192.168.0.0/24",
};

export class NetworkConfig {
  public readonly api: RequestorApi;
  public readonly mask?: string;
  public readonly ip: string;
  public readonly ownerId: string;
  public readonly ownerIp?: string;
  public readonly gateway?: string;
  public readonly logger?: Logger;
  public readonly apiUrl: string;

  constructor(options: NetworkOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || process.env.YAGNA_API_URL || DEFAULTS.basePath;
    this.apiUrl = `${basePath}/net-api/v1`;
    const apiConfig = new Configuration({ apiKey, basePath: this.apiUrl, accessToken: apiKey });
    this.api = new RequestorApi(apiConfig);
    this.ip = options?.ip || DEFAULTS.ip;
    this.mask = options?.mask;
    this.ownerId = options.ownerId;
    this.ownerIp = options?.ownerIp;
    this.gateway = options?.gateway;
    this.logger = options?.logger;
  }
}
