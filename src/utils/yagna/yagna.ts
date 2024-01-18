import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { RequestorApi as MarketRequestorApi } from "ya-ts-client/dist/ya-market/api";
import { RequestorApi as NetworkRequestorApi } from "ya-ts-client/dist/ya-net/api";
import { RequestorApi as PaymentRequestorApi } from "ya-ts-client/dist/ya-payment/api";
import { RequestorApi as IdentityRequestorApi } from "./identity";
import { RequestorApi as GsbRequestorApi } from "./gsb";
import { Agent } from "http";
import { Configuration } from "ya-ts-client/dist/ya-payment";
import * as EnvUtils from "../env";
import { GolemUserError } from "../../error/golem-error";
import { v4 } from "uuid";

export type YagnaApi = {
  market: MarketRequestorApi;
  activity: { control: RequestorControlApi; state: RequestorStateApi };
  net: NetworkRequestorApi;
  payment: PaymentRequestorApi;
  identity: IdentityRequestorApi;
  gsb: GsbRequestorApi;
  yagnaOptions: YagnaOptions;
  appSessionId: string;
};

export type YagnaOptions = {
  apiKey?: string;
  basePath?: string;
};

const CONNECTIONS_ERROR_CODES = ["ECONNREFUSED"];

export class Yagna {
  private readonly httpAgent: Agent;
  private readonly controller: AbortController;
  protected readonly apiKey: string;
  protected readonly apiBaseUrl: string;
  private readonly api: YagnaApi;
  constructor(options?: YagnaOptions) {
    this.httpAgent = new Agent({ keepAlive: true });
    this.controller = new AbortController();
    this.apiKey = options?.apiKey || EnvUtils.getYagnaAppKey();
    if (!this.apiKey) throw new GolemUserError("Api key not defined");
    this.apiBaseUrl = options?.basePath || EnvUtils.getYagnaApiUrl();
    this.api = this.createApi();
  }

  getApi(): YagnaApi {
    return this.api;
  }

  async connect(): Promise<void> {
    await this.api.identity.getIdentity();
  }

  async end(): Promise<void> {
    this.controller.abort();
    this.httpAgent.destroy?.();
  }

  protected createApi(): YagnaApi {
    const apiConfig = this.getApiConfig();
    const api = {
      market: new MarketRequestorApi(apiConfig, this.getApiUrl("market")),
      activity: {
        control: new RequestorControlApi(apiConfig, this.getApiUrl("activity")),
        state: new RequestorStateApi(apiConfig, this.getApiUrl("activity")),
      },
      net: new NetworkRequestorApi(apiConfig, this.getApiUrl("net")),
      payment: new PaymentRequestorApi(apiConfig, this.getApiUrl("payment")),
      identity: new IdentityRequestorApi(apiConfig, this.getApiUrl()),
      gsb: new GsbRequestorApi(apiConfig, this.getApiUrl("gsb")),
      yagnaOptions: {
        apiKey: this.apiKey,
        basePath: this.apiBaseUrl,
      },
      appSessionId: v4(),
    };
    this.addErrorHandler(api);
    return api;
  }

  protected getApiConfig(): Configuration {
    return new Configuration({
      apiKey: this.apiKey,
      accessToken: this.apiKey,
      baseOptions: {
        httpAgent: this.httpAgent,
        signal: this.controller.signal,
      },
    });
  }

  protected getApiUrl(apiName?: string): string {
    return apiName ? `${this.apiBaseUrl}/${apiName}-api/v1` : this.apiBaseUrl;
  }

  protected errorHandler(error: Error): Promise<Error> {
    if ("code" in error && CONNECTIONS_ERROR_CODES.includes((error.code as string) ?? "")) {
      return Promise.reject(
        new GolemUserError(
          `No connection to Yagna. Make sure the service is running at the address ${this.apiBaseUrl}`,
          error,
        ),
      );
    }
    return Promise.reject(error);
  }

  protected addErrorHandler(api: YagnaApi) {
    // Ugly solution until Yagna binding is refactored or replaced,
    // and it will be possible to pass interceptors as the config params
    api.net["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
    api.market["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
    api.activity.control["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
    api.activity.state["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
    api.payment["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
    api.identity["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
  }
}
