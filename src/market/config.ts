import { DemandOptions } from "./demand";
import { EnvUtils, Logger } from "../utils";
import { MarketOptions, ProposalFilter } from "./service";
import { YagnaOptions } from "../executor";
import { acceptAllProposalFilter } from "./strategy";

const DEFAULTS = {
  subnetTag: "public",
  marketTimeout: 1000 * 60 * 3, // 3 min,
  maxOfferEvents: 10,
  offerFetchingInterval: 10000,
  marketOfferExpiration: 1000 * 60 * 30, // 30 min
  debitNotesAcceptanceTimeout: 30,
  proposalFilter: acceptAllProposalFilter(),
};

/**
 * @internal
 */
export class DemandConfig {
  public readonly yagnaOptions?: YagnaOptions;
  public readonly timeout: number;
  public readonly expiration: number;
  public readonly subnetTag: string;
  public readonly maxOfferEvents: number;
  public readonly offerFetchingInterval: number;
  public readonly logger?: Logger;
  public readonly eventTarget?: EventTarget;

  constructor(options?: DemandOptions) {
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
