import { EventBus } from "../events/event_bus";
import { Logger } from "../utils";
import { yaMarket, yaActivity, yaNet, yaPayment } from "ya-ts-client";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { YagnaOptions } from "./executor";

export class ConfigContainer {
  readonly marketApi: yaMarket.RequestorApi;
  readonly activityControlApi: yaActivity.RequestorControlApi;
  readonly activityStateApi: yaActivity.RequestorStateApi;
  readonly netApi: yaNet.RequestorApi;
  readonly paymentApi: yaPayment.RequestorApi;

  constructor(yagnaOptions: YagnaOptions, readonly eventBus: EventBus, readonly logger?: Logger) {
    const apiKey = yagnaOptions.apiKey;
    const basePath = yagnaOptions.yagnaOptions.basePath || process.env.YAGNA_API_BASEPATH;
    if (!apiKey) throw new Error("Api key not defined");
    if (!basePath) throw new Error("Api base path not defined");
    this.marketApi = new RequestorApi(
      new yaMarket.Configuration({ apiKey, basePath: basePath + "/market-api/v1", accessToken: apiKey })
    );
    this.actiApi = new RequestorApi(
      new yaMarket.Configuration({ apiKey, basePath: basePath + "/market-api/v1", accessToken: apiKey })
    );
  }
}
