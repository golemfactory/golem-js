import { ActivityOptions } from "./activity";
import { yaActivity } from "ya-ts-client";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { EnvUtils, Logger } from "../utils";
import { YagnaOptions } from "../executor";
import { Agent } from "http";

const DEFAULTS = {
  activityRequestTimeout: 10000,
  activityExecuteTimeout: 1000 * 60 * 5, // 5 min,
  activityExeBatchResultsFetchInterval: 20000,
};

/**
 * @internal
 */
export class ActivityConfig {
  public readonly api: { control: RequestorControlApi; state: RequestorStateApi };
  public readonly activityRequestTimeout: number;
  public readonly activityExecuteTimeout: number;
  public readonly activityExeBatchResultsFetchInterval: number;
  public readonly logger?: Logger;
  public readonly eventTarget?: EventTarget;
  public readonly yagnaOptions: YagnaOptions;
  public readonly httpAgent: Agent;

  constructor(options?: ActivityOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || EnvUtils.getYagnaAppKey();
    if (!apiKey) throw new Error("Api key not defined");
    const basePath = options?.yagnaOptions?.basePath || EnvUtils.getYagnaApiUrl();
    this.httpAgent = new Agent({ keepAlive: true });
    const apiConfig = new yaActivity.Configuration({
      apiKey,
      basePath: `${basePath}/activity-api/v1`,
      accessToken: apiKey,
      baseOptions: { httpAgent: this.httpAgent },
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
