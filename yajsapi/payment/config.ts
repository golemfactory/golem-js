import { AllocationOptions } from "./allocation.js";
import { Configuration } from "ya-ts-client/dist/ya-payment/index.js";
import { RequestorApi } from "ya-ts-client/dist/ya-payment/api.js";
import { EnvUtils, Logger } from "../utils/index.js";
import { YagnaOptions } from "../executor/index.js";
import { PaymentOptions } from "./service.js";
import { InvoiceOptions } from "./invoice.js";

const DEFAULTS = {
  budget: 1.0,
  payment: { driver: "erc20", network: "rinkeby" },
  paymentTimeout: 20000,
  allocationExpires: 1000 * 60 * 30, // 30 min
  invoiceReceiveTimeout: 1000 * 60 * 5, // 5 min
  maxInvoiceEvents: 10,
  maxDebitNotesEvents: 10,
  invoiceFetchingInterval: 2000,
  debitNotesFetchingInterval: 2000,
  payingInterval: 2000,
  paymentRequestTimeout: 10000,
};

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

  constructor(public readonly options?: BasePaymentOptions) {
    this.yagnaOptions = options?.yagnaOptions;
    const apiKey = options?.yagnaOptions?.apiKey || EnvUtils.getYagnaAppKey();
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || EnvUtils.getYagnaApiUrl();
    const apiConfig = new Configuration({ apiKey, basePath: `${basePath}/payment-api/v1`, accessToken: apiKey });
    this.api = new RequestorApi(apiConfig);
    this.paymentTimeout = options?.paymentTimeout || DEFAULTS.paymentTimeout;
    this.payment = {
      driver: options?.payment?.driver || DEFAULTS.payment.driver,
      network: options?.payment?.network || DEFAULTS.payment.network,
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

  constructor(options?: PaymentOptions) {
    super(options);
    this.invoiceFetchingInterval = options?.invoiceFetchingInterval || DEFAULTS.invoiceFetchingInterval;
    this.debitNotesFetchingInterval = options?.debitNotesFetchingInterval || DEFAULTS.debitNotesFetchingInterval;
    this.maxInvoiceEvents = options?.maxInvoiceEvents || DEFAULTS.maxInvoiceEvents;
    this.maxDebitNotesEvents = options?.maxDebitNotesEvents || DEFAULTS.maxDebitNotesEvents;
    this.payingInterval = options?.payingInterval || DEFAULTS.payingInterval;
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

export class AccountConfig extends BaseConfig {
}
