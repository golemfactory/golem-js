import { AllocationOptions } from "./allocation";
import { Configuration } from "ya-ts-client/dist/ya-payment";
import { RequestorApi } from "ya-ts-client/dist/ya-payment/api";
import { EnvUtils, Logger } from "../utils";
import { YagnaOptions } from "../executor";
import { DebitNoteFilter, InvoiceFilter, PaymentOptions } from "./service";
import { InvoiceOptions } from "./invoice";
import { acceptAllDebitNotesFilter, acceptAllInvoicesFilter } from "./strategy";
import { Agent } from "http";

const DEFAULTS = Object.freeze({
  payment: { network: "goerli", driver: "erc20" },
  budget: 1.0,
  paymentTimeout: 1000 * 60 * 2, // 2 min
  allocationExpires: 1000 * 60 * 60, // 60 min
  invoiceReceiveTimeout: 1000 * 60 * 5, // 5 min
  maxInvoiceEvents: 500,
  maxDebitNotesEvents: 500,
  invoiceFetchingInterval: 2000,
  debitNotesFetchingInterval: 2000,
  payingInterval: 2000,
  paymentRequestTimeout: 10000,
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
  public readonly yagnaOptions?: YagnaOptions;
  public readonly paymentTimeout: number;
  public readonly api: RequestorApi;
  public readonly logger?: Logger;
  public readonly eventTarget?: EventTarget;
  public readonly payment: { driver: string; network: string };
  public readonly paymentRequestTimeout: number;
  public readonly httpAgent: Agent;

  constructor(public readonly options?: BasePaymentOptions) {
    this.yagnaOptions = options?.yagnaOptions;
    const apiKey = options?.yagnaOptions?.apiKey || EnvUtils.getYagnaAppKey();
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || EnvUtils.getYagnaApiUrl();
    this.httpAgent = new Agent({ keepAlive: true });
    const apiConfig = new Configuration({
      apiKey,
      basePath: `${basePath}/payment-api/v1`,
      accessToken: apiKey,
      baseOptions: { httpAgent: this.httpAgent },
    });
    this.api = new RequestorApi(apiConfig);
    this.paymentTimeout = options?.paymentTimeout || DEFAULTS.paymentTimeout;
    this.payment = {
      driver: options?.payment?.driver || DEFAULTS.payment.driver,
      network: options?.payment?.network || EnvUtils.getPaymentNetwork() || DEFAULTS.payment.network,
    };
    this.logger = options?.logger;
    this.eventTarget = options?.eventTarget;
    this.paymentRequestTimeout = options?.paymentRequestTimeout || DEFAULTS.paymentRequestTimeout;
  }
}
/**
 * @internal
 */
export class PaymentConfig extends BaseConfig {
  public readonly invoiceFetchingInterval: number;
  public readonly debitNotesFetchingInterval: number;
  public readonly payingInterval: number;
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
    this.payingInterval = options?.payingInterval ?? DEFAULTS.payingInterval;
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
    if (!options || !options?.account) throw new Error("Account option is required");
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

export class AccountConfig extends BaseConfig {}
