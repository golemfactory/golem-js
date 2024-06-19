import { Activity, ActivityStateEnum, IActivityRepository } from "../../../activity/activity";
import { ActivityApi } from "ya-ts-client";
import { IAgreementRepository } from "../../../market/agreement/agreement";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";
import { GolemWorkError, WorkErrorCode } from "../../../activity";
import { CacheService } from "../../cache/CacheService";

export class ActivityRepository implements IActivityRepository {
  private stateCache: CacheService<ActivityStateEnum> = new CacheService<ActivityStateEnum>();

  constructor(
    private readonly state: ActivityApi.RequestorStateService,
    private readonly agreementRepo: IAgreementRepository,
  ) {}

  async getById(id: string): Promise<Activity> {
    try {
      const agreementId = await this.state.getActivityAgreement(id);
      const agreement = await this.agreementRepo.getById(agreementId);
      const previousState = this.stateCache.get(id) ?? ActivityStateEnum.New;
      const state = await this.getStateOfActivity(id);
      const usage = await this.state.getActivityUsage(id);

      return new Activity(id, agreement, state ?? ActivityStateEnum.Unknown, previousState, usage);
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
      const yagnaStateResponse = await this.state.getActivityState(id);
      if (!yagnaStateResponse || yagnaStateResponse.state[0] === null) {
        return ActivityStateEnum.Unknown;
      }

      const state = ActivityStateEnum[yagnaStateResponse.state[0]];
      this.stateCache.set(id, state);
      return state;
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
