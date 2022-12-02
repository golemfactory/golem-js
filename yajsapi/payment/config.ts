import { AllocationOptions } from "./allocation";
import { Configuration } from "ya-ts-client/dist/ya-payment";
import { RequestorApi } from "ya-ts-client/dist/ya-payment/api";
import { Logger } from "../utils";
import { YagnaOptions } from "../executor";
import { PaymentOptions } from "./service";
import { InvoiceOptions } from "./invoice";

const DEFAULTS = {
  basePath: "http://127.0.0.1:7465/payment-api/v1",
  budget: 1.0,
  payment: { driver: "erc-20", network: "rinkeby" },
  timeout: 20000,
  allocationExpires: 1000 * 60 * 30, // 30 min
  invoiceReceiveTimeout: 1000 * 60 * 5, // 5 min
  maxInvoiceEvents: 10,
  maxDebitNotesEvents: 10,
  invoiceFetchingInterval: 2000,
  debitNotesFetchingInterval: 2000,
  payingInterval: 2000,
};

export interface BasePaymentOptions {
  yagnaOptions?: YagnaOptions;
  budget?: number;
  payment?: { driver?: string; network?: string };
  logger?: Logger;
  timeout?: number;
}

abstract class BaseConfig {
  public readonly timeout: number;
  public readonly api: RequestorApi;
  public readonly logger?: Logger;
  public readonly payment: { driver: string; network: string };

  protected constructor(public readonly options?: BasePaymentOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || process.env.YAGNA_API_BASEPATH || DEFAULTS.basePath;
    const apiConfig = new Configuration({ apiKey, basePath, accessToken: apiKey });
    this.api = new RequestorApi(apiConfig);
    this.timeout = options?.timeout || DEFAULTS.timeout;
    this.payment = {
      driver: options?.payment?.driver || DEFAULTS.payment.driver,
      network: options?.payment?.network || DEFAULTS.payment.network,
    };
    this.logger = options?.logger;
  }
}

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
  }
}

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

export class InvoiceConfig extends BaseConfig {
  constructor(options?: InvoiceOptions) {
    super(options);
  }
}
