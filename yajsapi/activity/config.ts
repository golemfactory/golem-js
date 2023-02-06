import { ActivityOptions } from "./activity.js";
import { yaActivity } from "ya-ts-client/index.js";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api.js";
import { Logger } from "../utils/index.js";
import { YagnaOptions } from "../executor/index.js";

const DEFAULTS = {
  basePath: "http://127.0.0.1:7465",
  activityRequestTimeout: 10000,
  activityExecuteTimeout: 60000,
  activityExeBatchResultsFetchInterval: 3000,
};

export class ActivityConfig {
  public readonly api: { control: RequestorControlApi; state: RequestorStateApi };
  public readonly activityRequestTimeout: number;
  public readonly activityExecuteTimeout: number;
  public readonly activityExeBatchResultsFetchInterval: number;
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
    this.activityRequestTimeout = options?.activityRequestTimeout || DEFAULTS.activityRequestTimeout;
    this.activityExecuteTimeout = options?.activityExecuteTimeout || DEFAULTS.activityExecuteTimeout;
    this.activityExeBatchResultsFetchInterval =
      options?.activityExeBatchResultsFetchInterval || DEFAULTS.activityExeBatchResultsFetchInterval;
    this.logger = options?.logger;
    this.yagnaOptions = { apiKey, basePath };
    this.eventTarget = options?.eventTarget;
  }
}
