import { Agreement } from "../../../market";
import { ActivityApi } from "ya-ts-client";
import { Activity, ActivityStateEnum, IActivityApi, Result } from "../../../activity";
import { IActivityRepository } from "../../../activity/activity";
import { ExeScriptRequest } from "../../../activity/exe-script-executor";
import { Observable } from "rxjs";
import { StreamingBatchEvent } from "../../../activity/results";
import { YagnaExeScriptObserver } from "../yagnaApi";
export declare class ActivityApiAdapter implements IActivityApi {
    private readonly state;
    private readonly control;
    private readonly exec;
    private readonly activityRepo;
    constructor(state: ActivityApi.RequestorStateService, control: ActivityApi.RequestorControlService, exec: YagnaExeScriptObserver, activityRepo: IActivityRepository);
    getActivity(id: string): Promise<Activity>;
    createActivity(agreement: Agreement): Promise<Activity>;
    destroyActivity(activity: Activity): Promise<Activity>;
    getActivityState(id: string): Promise<ActivityStateEnum>;
    executeScript(activity: Activity, script: ExeScriptRequest): Promise<string>;
    getExecBatchResults(activity: Activity, batchId: string, commandIndex?: number, timeout?: number): Promise<Result[]>;
    getExecBatchEvents(activity: Activity, batchId: string): Observable<StreamingBatchEvent>;
}
