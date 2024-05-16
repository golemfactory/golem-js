import { Logger, YagnaOptions } from "../shared/utils";

export interface BasePaymentOptions {
  yagnaOptions?: YagnaOptions;
  budget?: number;
  payment?: { driver?: string; network?: string };
  paymentTimeout?: number;
  paymentRequestTimeout?: number;
  unsubscribeTimeoutMs?: number;
  logger?: Logger;
}
