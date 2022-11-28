import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { yaActivity } from "ya-ts-client";
import { Activity, ActivityOptions } from "./activity";
import { runtimeContextChecker } from "../utils";

export class ActivityFactory {
  private readonly api: { control: RequestorControlApi; state: RequestorStateApi };

  /**
   * Creating ActivityFactory
   * @param agreementId
   * @param options - ActivityOptions
   * @param options.yagnaOptions.apiKey - Yagna Api Key
   * @param options.yagnaOptions.basePath - Yagna base path to Activity REST Api
   * @param options.requestTimeout - timeout for sending and creating batch
   * @param options.executeTimeout - timeout for executing batch
   * @param options.exeBatchResultsFetchInterval - interval for fetching batch results while polling
   * @param options.logger - logger module
   * @param options.taskPackage
   */
  constructor(private readonly agreementId: string, private readonly options?: ActivityOptions) {
    const apiKey = options?.yagnaOptions?.apiKey || process.env.YAGNA_APPKEY;
    if (!apiKey) throw new Error("Api key not defined");
    const basePath =
      options?.yagnaOptions?.basePath || process.env.YAGNA_API_BASEPATH || "http://127.0.0.1:7465/activity-api/v1";
    const apiConfig = new yaActivity.Configuration({ apiKey, basePath, accessToken: apiKey });
    this.api = {
      control: new RequestorControlApi(apiConfig),
      state: new RequestorStateApi(apiConfig),
    };
  }

  /**
   * Create activity for given agreement ID
   * @param secure defines if activity will be secure type
   */
  public async create(secure = false): Promise<Activity> {
    try {
      if (secure) {
        runtimeContextChecker.checkAndThrowUnsupportedInBrowserError("Secure Activity");
        const { createSecureActivity } = await import("./secure");
        return createSecureActivity(this.agreementId, this.api, this.options);
      }
      return this.createActivity(this.agreementId, this.options);
    } catch (error) {
      throw error?.response?.data?.message || error;
    }
  }

  private async createActivity(agreementId: string, options?: ActivityOptions): Promise<Activity> {
    const { data } = await this.api.control.createActivity({ agreementId });
    const activityId = typeof data == "string" ? data : data.activityId;
    return new Activity(activityId, this.api, options);
  }
}
