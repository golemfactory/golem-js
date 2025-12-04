import { Activity, ActivityStateEnum, IActivityRepository } from "../../../activity/activity";
import { ActivityApi } from "ya-ts-client";
import { IAgreementRepository } from "../../../market/agreement/agreement";
export declare class ActivityRepository implements IActivityRepository {
    private readonly state;
    private readonly agreementRepo;
    private stateCache;
    constructor(state: ActivityApi.RequestorStateService, agreementRepo: IAgreementRepository);
    getById(id: string): Promise<Activity>;
    getStateOfActivity(id: string): Promise<ActivityStateEnum>;
}
