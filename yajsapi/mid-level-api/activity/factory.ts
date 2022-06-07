import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/api";
import { yaActivity } from "ya-ts-client";
import { Activity, ActivityOptions } from "./activity";

export class ActivityFactory {
  private readonly api: RequestorControlApi;
  private readonly apiKey?: string;
  private readonly basePath?: string;
  constructor(apiKey?: string, basePath?: string) {
    this.apiKey = apiKey || process.env.YAGNA_APPKEY;
    this.basePath = basePath || process.env.YAGNA_API_BASEPATH;
    this.api = new RequestorControlApi(
      new yaActivity.Configuration({
        apiKey: this.apiKey,
        basePath: this.basePath,
        accessToken: this.apiKey,
      })
    );
  }
  async create(agreementId: string, options: ActivityOptions): Promise<Activity> {
    try {
      const { data } = await this.api.createActivity({ agreementId });
      const activityId = typeof data == "string" ? data : data.activityId;
      return new Activity(activityId, {
        credentials: {
          apiKey: this.apiKey,
          basePath: this.basePath,
        },
        ...options,
      });
    } catch (error) {
      throw error?.response?.data?.message || error;
    }
  }
}
