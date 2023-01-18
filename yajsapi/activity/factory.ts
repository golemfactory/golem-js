import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/api";
import { yaActivity } from "ya-ts-client";
import { Activity, ActivityOptions } from "./activity";
import { createSecureActivity, SecureActivity } from "./secure";

export class ActivityFactory {
  private readonly api: RequestorControlApi;
  private readonly apiKey?: string;
  private readonly basePath?: string;

  /**
   * Creating ActivityFactory
   * @param apiKey - Yagna Api Key
   * @param basePath - Yagna base path to Activity REST Api
   */
  constructor(apiKey?: string, basePath?: string) {
    this.apiKey = apiKey || process.env.YAGNA_APPKEY;
    this.basePath = basePath || process.env.YAGNA_API_BASEPATH || "http://127.0.0.1:7465/activity-api/v1";
    this.api = new RequestorControlApi(
      new yaActivity.Configuration({
        apiKey: this.apiKey,
        basePath: this.basePath,
        accessToken: this.apiKey,
      })
    );
  }

  /**
   * Create activity for given agreement ID
   * @param agreementId
   * @param options - ActivityOptions
   * @param options.credentials.apiKey - Yagna Api Key
   * @param options.credentials.basePath - Yagna base path to Activity REST Api
   * @param options.requestTimeout - timeout for sending and creating batch
   * @param options.executeTimeout - timeout for executing batch
   * @param options.exeBatchResultsFetchInterval - interval for fetching batch results while polling
   * @param options.logger - logger module
   * @param options.taskPackage
   * @param secure defines if activity will be secure type
   */
  public async create(
    agreementId: string,
    options?: ActivityOptions,
    secure = false
  ): Promise<Activity | SecureActivity> {
    try {
      return secure ? createSecureActivity(this.api, agreementId, options) : this.createActivity(agreementId, options);
    } catch (error) {
      throw error?.response?.data?.message || error;
    }
  }

  private async createActivity(agreementId: string, options?: ActivityOptions): Promise<Activity> {
    const { data } = await this.api.createActivity({ agreementId });
    const activityId = typeof data == "string" ? data : data.activityId;
    return new Activity(activityId, {
      credentials: {
        apiKey: this.apiKey,
        basePath: this.basePath,
      },
      ...options,
    });
  }
}
