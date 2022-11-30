import { DemandOptions } from "./demand";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Configuration } from "ya-ts-client/dist/ya-market";
import { Logger } from "../utils";

const DEFAULTS = {
  basePath: "http://127.0.0.1:7465/market-api/v1",
  subnetTag: "public",
  timeout: 20000,
  maxOfferEvents: 20,
};

export class DemandConfig {
  public readonly api: RequestorApi;
  public readonly timeout: number;
  public readonly subnetTag: string;
  public readonly maxOfferEvents: number;
  public readonly logger?: Logger;

  constructor(options?: DemandOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || process.env.YAGNA_API_BASEPATH || DEFAULTS.basePath;
    const apiConfig = new Configuration({ apiKey, basePath, accessToken: apiKey });
    this.api = new RequestorApi(apiConfig);
    this.subnetTag = options?.subnetTag || DEFAULTS.subnetTag;
    this.timeout = options?.timeout || DEFAULTS.timeout;
    this.logger = options?.logger;
    this.maxOfferEvents = options?.maxOfferEvents || DEFAULTS.maxOfferEvents;
  }
}
