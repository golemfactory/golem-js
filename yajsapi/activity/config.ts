import { ActivityOptions } from "./activity";
import { yaActivity } from "ya-ts-client";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { Logger } from "../utils";
import { YagnaOptions } from "../executor";

const DEFAULTS = {
  basePath: "http://127.0.0.1:7465",
  requestTimeout: 10000,
  executeTimeout: 30000,
  exeBatchResultsFetchInterval: 3000,
};

export class ActivityConfig {
  public readonly api: { control: RequestorControlApi; state: RequestorStateApi };
  public readonly requestTimeout: number;
  public readonly executeTimeout: number;
  public readonly exeBatchResultsFetchInterval: number;
  public readonly taskPackage?: string;
  public readonly logger?: Logger;
  public readonly eventTarget?: EventTarget;
  public readonly yagnaOptions: YagnaOptions;

  constructor(options?: ActivityOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || process.env.YAGNA_API_URL || DEFAULTS.basePath;
    const apiConfig = new yaActivity.Configuration({
      apiKey,
      basePath: `${basePath}/activity-api/v1`,
      accessToken: apiKey,
    });
    this.api = {
      control: new RequestorControlApi(apiConfig),
      state: new RequestorStateApi(apiConfig),
    };
    this.requestTimeout = options?.requestTimeout || DEFAULTS.requestTimeout;
    this.executeTimeout = options?.executeTimeout || DEFAULTS.executeTimeout;
    this.exeBatchResultsFetchInterval = options?.exeBatchResultsFetchInterval || DEFAULTS.exeBatchResultsFetchInterval;
    this.taskPackage = options?.taskPackage;
    this.logger = options?.logger;
    this.yagnaOptions = { apiKey, basePath };
    this.eventTarget = options?.eventTarget;
  }
}
