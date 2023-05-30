import { DemandOptions } from "./demand.js";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api.js";
import { Configuration } from "ya-ts-client/dist/ya-market/index.js";
import { EnvUtils, Logger } from "../utils/index.js";
import { MarketOptions } from "./service.js";
import { YagnaOptions } from "../executor/index.js";

const DEFAULTS = {
  subnetTag: "public",
  marketTimeout: 1000 * 60 * 3, // 3 min,
  maxOfferEvents: 10,
  offerFetchingInterval: 10000,
  marketOfferExpiration: 1000 * 60 * 15,
  debitNotesAcceptanceTimeout: 30,
};

/**
 * @internal
 */
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
    const apiKey = options?.yagnaOptions?.apiKey || EnvUtils.getYagnaAppKey();
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || EnvUtils.getYagnaApiUrl()
    const apiConfig = new Configuration({ apiKey, basePath: `${basePath}/market-api/v1`, accessToken: apiKey });
    this.yagnaOptions = options?.yagnaOptions;
    this.api = new RequestorApi(apiConfig);
    this.subnetTag = options?.subnetTag || EnvUtils.getYagnaSubnet() || DEFAULTS.subnetTag;
    this.timeout = options?.marketTimeout || DEFAULTS.marketTimeout;
    this.expiration = options?.marketOfferExpiration || DEFAULTS.marketOfferExpiration;
    this.offerFetchingInterval = options?.offerFetchingInterval || DEFAULTS.offerFetchingInterval;
    this.logger = options?.logger;
    this.maxOfferEvents = options?.maxOfferEvents || DEFAULTS.maxOfferEvents;
    this.eventTarget = options?.eventTarget;
  }
}

/**
 * @internal
 */
export class MarketConfig extends DemandConfig {
  readonly debitNotesAcceptanceTimeout: number;
  constructor(options?: MarketOptions) {
    super(options);
    this.debitNotesAcceptanceTimeout = options?.debitNotesAcceptanceTimeout || DEFAULTS.debitNotesAcceptanceTimeout;
  }
}
