import { RequestorControlApi } from "ya-ts-client/dist/ya-activity/api";

export class ActivityFactory {
  private api: RequestorControlApi;
  constructor() {
    this.api = new RequestorControlApi();
  }
  async create(agreementId: string): Promise<string> {
    const { data } = await this.api.createActivity({ agreementId });
    return typeof data == "string" ? data : data.activityId;
  }
}
