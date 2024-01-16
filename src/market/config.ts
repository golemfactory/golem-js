import { DemandOptions } from "./demand";
import { EnvUtils, Logger } from "../utils";
import { MarketOptions, ProposalFilter } from "./service";
import { YagnaOptions } from "../executor";
import { acceptAllProposalFilter } from "./strategy";
import { GolemUserError } from "../error/golem-error";

const DEFAULTS = {
  subnetTag: "public",
  maxOfferEvents: 10,
  offerFetchingIntervalSec: 20,
  expirationSec: 30 * 60, // 30 min
  debitNotesAcceptanceTimeoutSec: 2 * 60, // 2 minutes
  midAgreementDebitNoteIntervalSec: 2 * 60, // 2 minutes
  midAgreementPaymentTimeoutSec: 12 * 60 * 60, // 12 hours
  proposalFilter: acceptAllProposalFilter(),
};

/**
 * @internal
 */
export class DemandConfig {
  public readonly yagnaOptions?: YagnaOptions;
  public readonly expirationSec: number;
  public readonly subnetTag: string;
  public readonly maxOfferEvents: number;
  public readonly offerFetchingIntervalSec: number;
  public readonly logger?: Logger;
  public readonly eventTarget?: EventTarget;
  public readonly debitNotesAcceptanceTimeoutSec: number;
  public readonly midAgreementDebitNoteIntervalSec: number;
  public readonly midAgreementPaymentTimeoutSec: number;

  constructor(options?: DemandOptions) {
    this.logger = options?.logger;
    this.eventTarget = options?.eventTarget;

    this.subnetTag = options?.subnetTag ?? EnvUtils.getYagnaSubnet() ?? DEFAULTS.subnetTag;
    this.offerFetchingIntervalSec = options?.offerFetchingIntervalSec ?? DEFAULTS.offerFetchingIntervalSec;
    this.maxOfferEvents = options?.maxOfferEvents ?? DEFAULTS.maxOfferEvents;

    this.expirationSec = options?.expirationSec ?? DEFAULTS.expirationSec;

    if (!this.isPositiveInt(this.expirationSec)) {
      throw new GolemUserError("The demand expiration time has to be a positive integer");
    }

    this.debitNotesAcceptanceTimeoutSec =
      options?.debitNotesAcceptanceTimeoutSec ?? DEFAULTS.debitNotesAcceptanceTimeoutSec;

    if (!this.isPositiveInt(this.debitNotesAcceptanceTimeoutSec)) {
      throw new GolemUserError("The debit note acceptance timeout time has to be a positive integer");
    }

    this.midAgreementDebitNoteIntervalSec =
      options?.midAgreementDebitNoteIntervalSec ?? DEFAULTS.midAgreementDebitNoteIntervalSec;

    if (!this.isPositiveInt(this.midAgreementDebitNoteIntervalSec)) {
      throw new GolemUserError("The debit note interval time has to be a positive integer");
    }

    this.midAgreementPaymentTimeoutSec =
      options?.midAgreementPaymentTimeoutSec ?? DEFAULTS.midAgreementPaymentTimeoutSec;

    if (!this.isPositiveInt(this.midAgreementPaymentTimeoutSec)) {
      throw new GolemUserError("The mid-agreement payment timeout time has to be a positive integer");
    }
  }

  private isPositiveInt(value: number) {
    return value > 0 && Number.isInteger(value);
  }
}

/**
 * @internal
 */
export class MarketConfig extends DemandConfig {
  readonly debitNotesAcceptanceTimeoutSec: number;
  public readonly proposalFilter: ProposalFilter;

  constructor(options?: MarketOptions) {
    super(options);

    this.debitNotesAcceptanceTimeoutSec =
      options?.debitNotesAcceptanceTimeoutSec ?? DEFAULTS.debitNotesAcceptanceTimeoutSec;

    this.proposalFilter = options?.proposalFilter ?? DEFAULTS.proposalFilter;
  }
}
