import { Activity, ActivityOptions } from "./activity";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import { logger } from "../../utils";

export class ActivityFactory {
  private api: RequestorControlApi;
  constructor() {
    this.api = new RequestorControlApi();
  }
  async create(agreementId: string, options?: ActivityOptions): Promise<Activity> {
    const { data } = await this.api.createActivity({ agreementId });
    const activityId = typeof data == "string" ? data : data.activityId;
    logger.debug(`Created activity ${activityId} for agreement ${agreementId}`);
    return new Activity(activityId, options);
  }
}
