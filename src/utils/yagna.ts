import { YagnaOptions } from "../executor";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { RequestorApi as MarketRequestorApi } from "ya-ts-client/dist/ya-market/api";
import { RequestorApi as NetworkRequestorApi } from "ya-ts-client/dist/ya-net/api";
import { RequestorApi as PaymentRequestorApi } from "ya-ts-client/dist/ya-payment/api";
import { AxiosPromise, AxiosRequestConfig } from "axios";

interface IdentityRequestorApi {
  getIdentity(options?: AxiosRequestConfig): AxiosPromise<string>;
}

export type YagnaApi = {
  market: MarketRequestorApi;
  activity: { control: RequestorControlApi; state: RequestorStateApi };
  net: NetworkRequestorApi;
  payment: PaymentRequestorApi;
  identity: IdentityRequestorApi;
};

export type YagnaOptions = {
  apiKey?: string;
  basePath?: string;
};

export class YagnaConnection {
  constructor(private options: YagnaOptions) {}

  async connect(): Promise<YagnaApi> {
    return Promise.resolve({} as YagnaApi);
  }

  async close(): Promise<boolean> {
    return true;
  }
}
