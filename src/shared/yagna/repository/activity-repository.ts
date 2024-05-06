import { Activity, ActivityStateEnum, IActivityRepository } from "../../../activity/activity";
import { ActivityApi } from "ya-ts-client";
import { IAgreementRepository } from "../../../agreement/agreement";

export class ActivityRepository implements IActivityRepository {
  constructor(
    private readonly state: ActivityApi.RequestorStateService,
    private readonly agreementRepo: IAgreementRepository,
  ) {}

  async getById(id: string): Promise<Activity> {
    const agreementId = await this.state.getActivityAgreement(id);
    const agreement = await this.agreementRepo.getById(agreementId);
    const state = await this.getStateOfActivity(id);
    const usage = await this.state.getActivityUsage(id);

    return new Activity(id, agreement, state ?? ActivityStateEnum.Unknown, usage);
  }

  async getStateOfActivity(id: string): Promise<ActivityStateEnum> {
    const state = await this.state.getActivityState(id);
    if (!state || state.state[0] === null) {
      return ActivityStateEnum.Unknown;
    }

    return ActivityStateEnum[state.state[0]];
  }
}
