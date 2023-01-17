import { DemandOptions } from "./demand";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Configuration } from "ya-ts-client/dist/ya-market";
import { Logger } from "../utils";
import { MarketOptions } from "./service";
import { YagnaOptions } from "../executor";

const DEFAULTS = {
  basePath: "http://127.0.0.1:7465",
  subnetTag: "public",
  timeout: 1000 * 60 * 3, // 15 min,
  maxOfferEvents: 10,
  offerFetchingInterval: 10000,
  expiration: 1000 * 60 * 15,
  debitNotesAcceptanceTimeout: 30,
};

export class DemandConfig {
  public readonly api: RequestorApi;
  public readonly yagnaOptions?: YagnaOptions;
  public readonly timeout: number;
  public readonly expiration: number;
  public readonly subnetTag: string;
  public readonly maxOfferEvents: number;
  public readonly offerFetchingInterval: number;
  public readonly proposalTimeout?: number;
  public readonly logger?: Logger;
  public readonly eventTarget?: EventTarget;

  constructor(options?: DemandOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || process.env.YAGNA_API_URL || DEFAULTS.basePath;
    const apiConfig = new Configuration({ apiKey, basePath: `${basePath}/market-api/v1`, accessToken: apiKey });
    this.yagnaOptions = options?.yagnaOptions;
    this.api = new RequestorApi(apiConfig);
    this.subnetTag = options?.subnetTag || process.env.YAGNA_SUBNET || DEFAULTS.subnetTag;
    this.timeout = options?.timeout || DEFAULTS.timeout;
    this.expiration = options?.expiration || DEFAULTS.expiration;
    this.offerFetchingInterval = options?.offerFetchingInterval || DEFAULTS.offerFetchingInterval;
    this.logger = options?.logger;
    this.maxOfferEvents = options?.maxOfferEvents || DEFAULTS.maxOfferEvents;
    this.eventTarget = options?.eventTarget;
  }
}

export class MarketConfig extends DemandConfig {
  readonly debitNotesAcceptanceTimeout: number;
  constructor(options?: MarketOptions) {
    super(options);
    this.debitNotesAcceptanceTimeout = options?.debitNotesAcceptanceTimeout || DEFAULTS.debitNotesAcceptanceTimeout;
  }
}
