import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/api";
import { RequestorApi as MarketRequestorApi } from "ya-ts-client/dist/ya-market/api";
import { RequestorApi as NetworkRequestorApi } from "ya-ts-client/dist/ya-net/api";
import { RequestorApi as PaymentRequestorApi } from "ya-ts-client/dist/ya-payment/api";
import { RequestorApi as IdentityRequestorApi } from "./identity";
import { RequestorApi as GsbRequestorApi } from "./gsb";
import { RequestorApi as RequestorStateApi } from "./activity";
import { Agent } from "http";
import { Configuration } from "ya-ts-client/dist/ya-payment";
import * as EnvUtils from "../env";
import { GolemConfigError, GolemPlatformError, GolemUserError } from "../../error/golem-error";
import { v4 } from "uuid";
import semverSatisfies from "semver/functions/satisfies";
import semverCoerce from "semver/functions/coerce";

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
  abortController?: AbortController;
};

type YagnaVersionInfo = {
  // @example 0.13.2
  version: string;
  // @example v0.13.2
  name: string;
  seen: boolean;
  // @example "2023-12-07T14:23:48"
  releaseTs: string;
  insertionTs: string;
  updateTs: string;
};

type YagnaVersionResponse = {
  current: YagnaVersionInfo;
  pending: YagnaVersionInfo | null;
};

const CONNECTIONS_ERROR_CODES = ["ECONNREFUSED"];

export const MIN_SUPPORTED_YAGNA = "0.13.2";

export class Yagna {
  private readonly httpAgent: Agent;
  private readonly controller: AbortController;
  protected readonly apiKey: string;
  protected readonly apiBaseUrl: string;
  private readonly api: YagnaApi;

  constructor(options?: YagnaOptions) {
    this.httpAgent = new Agent({ keepAlive: true });
    this.controller = options?.abortController ?? new AbortController();
    this.apiKey = options?.apiKey || EnvUtils.getYagnaAppKey();
    if (!this.apiKey) throw new GolemConfigError("Api key not defined");
    this.apiBaseUrl = options?.basePath || EnvUtils.getYagnaApiUrl();
    this.api = this.createApi();
  }

  getApi(): YagnaApi {
    return this.api;
  }

  async connect() {
    await this.assertSupportedVersion();
    return this.api.identity.getIdentity();
  }

  private async assertSupportedVersion() {
    const version = await this.getVersion();

    const normVersion = semverCoerce(version);
    if (!normVersion) {
      throw new GolemPlatformError(
        `Unreadable yana version '${version}'. Can't proceed without checking yagna version support status.`,
      );
    }

    if (!semverSatisfies(normVersion, `>=${MIN_SUPPORTED_YAGNA}`)) {
      throw new GolemPlatformError(
        `You run yagna in version ${version} and the minimal version supported by the SDK is ${MIN_SUPPORTED_YAGNA}. ` +
          `Please consult the golem-js README to find matching SDK version or upgrade your yagna installation.`,
      );
    }

    return normVersion.version;
  }

  async end(): Promise<void> {
    this.controller.abort();
    this.httpAgent.destroy?.();
  }

  public async getVersion(): Promise<string> {
    try {
      const res: YagnaVersionResponse = await fetch(`${this.apiBaseUrl}/version/get`, {
        method: "GET",
        signal: this.controller.signal,
      }).then((res) => res.json());

      return res.current.version;
    } catch (err) {
      throw new GolemPlatformError(`Failed to establish yagna version due to: ${err}`, err);
    }
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
    return Promise.reject(new GolemPlatformError(`Yagna request failed. ${error}`, error));
  }

  protected addErrorHandler(api: YagnaApi) {
    /**
     * Ugly solution until Yagna binding is refactored or replaced,
     * and it will be possible to pass interceptors as the config params.
     *
     * All RequestorAPI instances (market, identity, payment, etc.) use the same Axios instance,
     * so it is enough to add one interceptor to one of them to make it effective in each API.
     */
    api.identity["axios"].interceptors.response.use(undefined, this.errorHandler.bind(this));
  }
}
