import { Agreement } from "../../../market/agreement";
import { ActivityApi } from "ya-ts-client";
import { Activity, ActivityStateEnum, GolemWorkError, IActivityApi, WorkErrorCode } from "../../../activity";
import { IActivityRepository } from "../../../activity/activity";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";

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
    try {
      const activityOrError = await this.control.createActivity({
        agreementId: agreement.id,
      });

      if (typeof activityOrError !== "object" || !("activityId" in activityOrError)) {
        // will be caught in the catch block and converted to GolemWorkError
        throw new Error(activityOrError);
      }

      return this.activityRepo.getById(activityOrError.activityId);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemWorkError(
        `Failed to create activity: ${message}`,
        WorkErrorCode.ActivityCreationFailed,
        agreement,
        undefined,
        agreement.getProviderInfo(),
      );
    }
  }

  async destroyActivity(activity: Activity): Promise<Activity> {
    try {
      await this.control.destroyActivity(activity.id, 30);

      return this.activityRepo.getById(activity.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemWorkError(
        `Failed to destroy activity: ${message}`,
        WorkErrorCode.ActivityDestroyingFailed,
        activity.agreement,
        activity,
        activity.agreement.getProviderInfo(),
      );
    }
  }

  async getActivityState(id: string): Promise<ActivityStateEnum> {
    return this.activityRepo.getStateOfActivity(id);
  }
}
