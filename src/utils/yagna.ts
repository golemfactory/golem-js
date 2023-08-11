import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { RequestorApi as MarketRequestorApi } from "ya-ts-client/dist/ya-market/api";
import { RequestorApi as NetworkRequestorApi } from "ya-ts-client/dist/ya-net/api";
import { RequestorApi as PaymentRequestorApi } from "ya-ts-client/dist/ya-payment/api";
import { RequestorApi as IdentityRequestorApi } from "./identity";
import { Agent } from "http";
import { Configuration } from "ya-ts-client/dist/ya-payment";
import { EnvUtils } from "./env";
import { AxiosError } from "axios";

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

const CONNECTIONS_ERROR_CODES = ["ECONNREFUSED"];

export class YagnaConnection {
  private readonly httpAgent: Agent;
  private readonly controller: AbortController;
  private readonly apiKey: string;
  private readonly apiBaseUrl: string;
  private readonly api: YagnaApi;
  private identity?: string;
  constructor(options?: YagnaOptions) {
    this.httpAgent = new Agent({ keepAlive: true });
    this.controller = new AbortController();
    this.apiKey = options?.apiKey || EnvUtils.getYagnaAppKey();
    if (!this.apiKey) throw new Error("Api key not defined");
    this.apiBaseUrl = options?.basePath || EnvUtils.getYagnaApiUrl();
    this.api = this.createApi();
  }

  async connect(): Promise<YagnaApi> {
    const { data } = await this.api.identity.getIdentity();
    this.identity = data.identity;
    return this.api;
  }

  async end(): Promise<void> {
    this.controller.abort();
    this.httpAgent.destroy?.();
  }

  getIdentity(): string {
    if (!this.identity) throw new Error("Yagna is not connected");
    return this.identity;
  }

  private createApi(): YagnaApi {
    const apiConfig = this.getApiConfig();
    const api = {
      market: new MarketRequestorApi(apiConfig, this.getApiUrl("market")),
      activity: {
        control: new RequestorControlApi(apiConfig, this.getApiUrl("activity")),
        state: new RequestorStateApi(apiConfig, this.getApiUrl("activity")),
      },
      net: new NetworkRequestorApi(apiConfig, this.getApiUrl("network")),
      payment: new PaymentRequestorApi(apiConfig, this.getApiUrl("payment")),
      identity: new IdentityRequestorApi(apiConfig, this.getApiUrl()),
    };
    this.addErrorHandler(api);
    return api;
  }

  private getApiConfig(): Configuration {
    return new Configuration({
      apiKey: this.apiKey,
      accessToken: this.apiKey,
      baseOptions: {
        httpAgent: this.httpAgent,
        signal: this.controller.signal,
      },
    });
  }

  private getApiUrl(apiName?: string): string {
    return apiName ? `${this.apiBaseUrl}/${apiName}-api/v1` : this.apiBaseUrl;
  }

  private errorHandler(error: AxiosError): Promise<AxiosError> {
    if (CONNECTIONS_ERROR_CODES.includes(error.code || "")) {
      console.log(error.toString());
      return Promise.reject(
        `No connection to Yagna. Make sure the service is running at the address ${this.apiBaseUrl}`,
      );
    }
    return Promise.reject(error);
  }

  private addErrorHandler(api: YagnaApi) {
    // Ugly solution until Yagna binding is refactored,
    // and it will be possible to pass interceptors as the config params
    api.net["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
    api.market["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
    api.activity.control["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
    api.activity.state["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
    api.payment["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
    api.identity["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
  }
}
