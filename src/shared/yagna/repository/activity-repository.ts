import { Activity, ActivityStateEnum, IActivityRepository } from "../../../activity/activity";
import { ActivityApi } from "ya-ts-client";
import { IAgreementRepository } from "../../../agreement/agreement";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";
import { GolemWorkError, WorkErrorCode } from "../../../activity";

export class ActivityRepository implements IActivityRepository {
  constructor(
    private readonly state: ActivityApi.RequestorStateService,
    private readonly agreementRepo: IAgreementRepository,
  ) {}

  async getById(id: string): Promise<Activity> {
    try {
      const agreementId = await this.state.getActivityAgreement(id);
      const agreement = await this.agreementRepo.getById(agreementId);
      const state = await this.getStateOfActivity(id);
      const usage = await this.state.getActivityUsage(id);

      return new Activity(id, agreement, state ?? ActivityStateEnum.Unknown, usage);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemWorkError(
        `Failed to get activity: ${message}`,
        WorkErrorCode.ActivityStatusQueryFailed,
        undefined,
        undefined,
        undefined,
        error,
      );
    }
  }

  async getStateOfActivity(id: string): Promise<ActivityStateEnum> {
    try {
      const state = await this.state.getActivityState(id);
      if (!state || state.state[0] === null) {
        return ActivityStateEnum.Unknown;
      }

      return ActivityStateEnum[state.state[0]];
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemWorkError(
        `Failed to get activity state: ${message}`,
        WorkErrorCode.ActivityStatusQueryFailed,
        undefined,
        undefined,
        undefined,
        error,
      );
    }
  }
}
