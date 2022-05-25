import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/api";
import { yaActivity } from "ya-ts-client";

export class ActivityFactory {
  private api: RequestorControlApi;
  constructor() {
    // TODO: check appkey and basepath
    this.api = new RequestorControlApi(
      new yaActivity.Configuration({
        apiKey: process.env.YAGNA_APPKEY,
        basePath: process.env.YAGNA_API_BASEPATH + "/activity-api/v1",
        accessToken: process.env.YAGNA_APPKEY,
      })
    );
  }
  async create(agreementId: string): Promise<string> {
    const { data } = await this.api.createActivity({ agreementId });
    return typeof data == "string" ? data : data.activityId;
  }
}
