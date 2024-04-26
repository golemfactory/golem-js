import { Agreement, IActivityApi } from "../../../agreement";
import { ActivityApi } from "ya-ts-client";
import { Activity, ActivityStateEnum } from "../../../activity";
import { IActivityRepository } from "../../../activity/activity";

export class ActivityApiAdapter implements IActivityApi {
  constructor(
    private readonly state: ActivityApi.RequestorStateService,
    private readonly control: ActivityApi.RequestorControlService,
    private readonly activityRepo: IActivityRepository,
  ) {}

  getActivity(id: string): Promise<Activity> {
    return this.activityRepo.getById(id);
  }

  async createActivity(agreement: Agreement): Promise<Activity> {
    // TODO: Use options
    // @ts-expect-error: FIXME #yagna ts types
    const { activityId } = await this.control.createActivity({
      agreementId: agreement.id,
    });

    return this.activityRepo.getById(activityId);
  }

  async destroyActivity(activity: Activity): Promise<Activity> {
    await this.control.destroyActivity(activity.id, 30);

    return this.activityRepo.getById(activity.id);
  }

  async getActivityState(id: string): Promise<ActivityStateEnum> {
    return this.activityRepo.getStateOfActivity(id);
  }
}
