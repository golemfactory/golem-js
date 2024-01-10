import { AllocationOptions } from "./allocation";
import { EnvUtils, Logger, defaultLogger } from "../utils";
import { YagnaOptions } from "../executor";
import { DebitNoteFilter, InvoiceFilter, PaymentOptions } from "./service";
import { InvoiceOptions } from "./invoice";
import { acceptAllDebitNotesFilter, acceptAllInvoicesFilter } from "./strategy";
import { GolemError } from "../error/golem-error";

const DEFAULTS = Object.freeze({
  payment: { network: "holesky", driver: "erc20" },
  budget: 1.0,
  paymentTimeout: 1000 * 60, // 1 min
  allocationExpires: 1000 * 60 * 60, // 60 min
  invoiceReceiveTimeout: 1000 * 60 * 5, // 5 min
  maxInvoiceEvents: 500,
  maxDebitNotesEvents: 500,
  invoiceFetchingInterval: 20000,
  debitNotesFetchingInterval: 20000,
  debitNoteFilter: acceptAllDebitNotesFilter(),
  invoiceFilter: acceptAllInvoicesFilter(),
});

export interface BasePaymentOptions {
  yagnaOptions?: YagnaOptions;
  budget?: number;
  payment?: { driver?: string; network?: string };
  paymentTimeout?: number;
  paymentRequestTimeout?: number;
  logger?: Logger;
  eventTarget?: EventTarget;
}
/**
 * @internal
 */
abstract class BaseConfig {
  public readonly paymentTimeout: number;
  public readonly eventTarget?: EventTarget;
  public readonly payment: { driver: string; network: string };
  public readonly options?: BasePaymentOptions;
  public readonly logger: Logger;

  constructor(options?: BasePaymentOptions) {
    this.options = options;
    this.paymentTimeout = options?.paymentTimeout || DEFAULTS.paymentTimeout;
    this.payment = {
      driver: options?.payment?.driver || DEFAULTS.payment.driver,
      network: options?.payment?.network || EnvUtils.getPaymentNetwork() || DEFAULTS.payment.network,
    };
    this.logger = options?.logger || defaultLogger("payment");
    this.eventTarget = options?.eventTarget;
  }
}
/**
 * @internal
 */
export class PaymentConfig extends BaseConfig {
  public readonly invoiceFetchingInterval: number;
  public readonly debitNotesFetchingInterval: number;
  public readonly maxInvoiceEvents: number;
  public readonly maxDebitNotesEvents: number;
  public readonly debitNoteFilter: DebitNoteFilter;
  public readonly invoiceFilter: InvoiceFilter;

  constructor(options?: PaymentOptions) {
    super(options);
    this.invoiceFetchingInterval = options?.invoiceFetchingInterval ?? DEFAULTS.invoiceFetchingInterval;
    this.debitNotesFetchingInterval = options?.debitNotesFetchingInterval ?? DEFAULTS.debitNotesFetchingInterval;
    this.maxInvoiceEvents = options?.maxInvoiceEvents ?? DEFAULTS.maxInvoiceEvents;
    this.maxDebitNotesEvents = options?.maxDebitNotesEvents ?? DEFAULTS.maxDebitNotesEvents;
    this.debitNoteFilter = options?.debitNotesFilter ?? DEFAULTS.debitNoteFilter;
    this.invoiceFilter = options?.invoiceFilter ?? DEFAULTS.invoiceFilter;
  }
}
/**
 * @internal
 */
export class AllocationConfig extends BaseConfig {
  public readonly budget: number;
  public readonly payment: { driver: string; network: string };
  public readonly expires: number;
  public readonly account: { address: string; platform: string };

  constructor(options?: AllocationOptions) {
    super(options);
    if (!options || !options?.account) {
      throw new GolemError("Account option is required");
    }
    this.account = options.account;
    this.budget = options?.budget || DEFAULTS.budget;
    this.payment = {
      driver: options?.payment?.driver || DEFAULTS.payment.driver,
      network: options?.payment?.network || DEFAULTS.payment.network,
    };
    this.expires = options?.expires || DEFAULTS.allocationExpires;
  }
}
/**
 * @internal
 */
export class InvoiceConfig extends BaseConfig {
  constructor(options?: InvoiceOptions) {
    super(options);
  }
}
