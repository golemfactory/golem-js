import { DemandOptions } from "./demand";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Configuration } from "ya-ts-client/dist/ya-market";
import { EnvUtils, Logger } from "../utils";
import { MarketOptions, ProposalFilter } from "./service";
import { YagnaOptions } from "../executor";
import { Agent } from "http";
import { acceptAllProposalFilter } from "./strategy";

const DEFAULTS = {
  subnetTag: "public",
  marketTimeout: 1000 * 60 * 3, // 3 min,
  maxOfferEvents: 10,
  offerFetchingInterval: 20000,
  marketOfferExpiration: 1000 * 60 * 30, // 30 min
  debitNotesAcceptanceTimeout: 30,
  proposalFilter: acceptAllProposalFilter(),
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
  public readonly logger?: Logger;
  public readonly eventTarget?: EventTarget;
  public readonly httpAgent: Agent;

  constructor(options?: DemandOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || EnvUtils.getYagnaAppKey();
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || EnvUtils.getYagnaApiUrl();
    this.httpAgent = new Agent({ keepAlive: true });
    const apiConfig = new Configuration({
      apiKey,
      basePath: `${basePath}/market-api/v1`,
      accessToken: apiKey,
      baseOptions: { httpAgent: this.httpAgent },
    });
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
  public readonly proposalFilter: ProposalFilter;
  constructor(options?: MarketOptions) {
    super(options);
    this.debitNotesAcceptanceTimeout = options?.debitNotesAcceptanceTimeout || DEFAULTS.debitNotesAcceptanceTimeout;
    this.proposalFilter = options?.proposalFilter ?? DEFAULTS.proposalFilter;
  }
}
