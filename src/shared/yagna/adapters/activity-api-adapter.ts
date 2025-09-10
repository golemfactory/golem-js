import { Agreement } from "../../../market";
import { ActivityApi } from "ya-ts-client";
import { Activity, ActivityStateEnum, GolemWorkError, IActivityApi, Result, WorkErrorCode } from "../../../activity";
import { IActivityRepository } from "../../../activity/activity";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";
import { ExeScriptRequest } from "../../../activity/exe-script-executor";
import { Observable } from "rxjs";
import { StreamingBatchEvent } from "../../../activity/results";
import { YagnaExeScriptObserver } from "../yagnaApi";
import { cancelYagnaApiCall } from "../../utils/cancel";
import { createAbortSignalFromTimeout } from "../../utils";

export class ActivityApiAdapter implements IActivityApi {
  constructor(
    private readonly state: ActivityApi.RequestorStateService,
    private readonly control: ActivityApi.RequestorControlService,
    private readonly exec: YagnaExeScriptObserver,
    private readonly activityRepo: IActivityRepository,
  ) {}

  getActivity(id: string): Promise<Activity> {
    return this.activityRepo.getById(id);
  }

  async createActivity(agreement: Agreement, signalOrTimeout?: AbortSignal | number): Promise<Activity> {
    try {
      const activityOrError = await cancelYagnaApiCall(
        this.control.createActivity({
          agreementId: agreement.id,
        }),
        createAbortSignalFromTimeout(signalOrTimeout),
      );

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
        agreement.provider,
      );
    }
  }

  async destroyActivity(activity: Activity, signalOrTimeout?: AbortSignal | number): Promise<Activity> {
    try {
      await cancelYagnaApiCall(
        this.control.destroyActivity(activity.id, 30),
        createAbortSignalFromTimeout(signalOrTimeout),
      );
      return this.activityRepo.getById(activity.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemWorkError(
        `Failed to destroy activity: ${message}`,
        WorkErrorCode.ActivityDestroyingFailed,
        activity.agreement,
        activity,
        activity.agreement.provider,
      );
    }
  }

  async getActivityState(id: string): Promise<ActivityStateEnum> {
    return this.activityRepo.getStateOfActivity(id);
  }

  async executeScript(activity: Activity, script: ExeScriptRequest): Promise<string> {
    try {
      return await this.control.exec(activity.id, script);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemWorkError(
        `Failed to execute script. ${message}`,
        WorkErrorCode.ScriptExecutionFailed,
        activity.agreement,
        activity,
        activity.agreement.provider,
      );
    }
  }

  async getExecBatchResults(
    activity: Activity,
    batchId: string,
    commandIndex?: number,
    timeout?: number,
  ): Promise<Result[]> {
    try {
      const results = await this.control.getExecBatchResults(activity.id, batchId, commandIndex, timeout);
      return results.map((r) => new Result(r));
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemWorkError(
        `Failed to fetch activity results. ${message}`,
        WorkErrorCode.ActivityResultsFetchingFailed,
        activity.agreement,
        activity,
        activity.provider,
        error,
      );
    }
  }

  getExecBatchEvents(
    activity: Activity,
    batchId: string,
    // commandIndex?: number | undefined, TODO: when it will be implemented in yagna
  ): Observable<StreamingBatchEvent> {
    return this.exec.observeBatchExecResults(activity.id, batchId);
  }
}
