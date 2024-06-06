import { Activity, ActivityStateEnum } from "./activity";
import { Agreement } from "../market/agreement";
import { ExeScriptRequest } from "./exe-script-executor";
import { Result, StreamingBatchEvent } from "./results";
import { Observable } from "rxjs";

export type ActivityEvents = {
  activityCreated: (activity: Activity) => void;
  errorCreatingActivity: (error: Error) => void;

  activityDestroyed: (activity: Activity) => void;
  errorDestroyingActivity: (activity: Activity, error: Error) => void;

  activityInitialized: (activity: Activity) => void;
  errorInitializingActivity: (activity: Activity, error: Error) => void;

  activityStateChanged: (activity: Activity, previousState: ActivityStateEnum) => void;
  errorRefreshingActivity: (activity: Activity, error: Error) => void;

  scriptExecuted: (activity: Activity, script: ExeScriptRequest, result: string) => void;
  errorExecutingScript: (activity: Activity, script: ExeScriptRequest, error: Error) => void;

  batchResultsReceived: (activity: Activity, batchId: string, results: Result[]) => void;
  errorGettingBatchResults: (activity: Activity, batchId: string, error: Error) => void;

  batchEventsReceived: (activity: Activity, batchId: string, event: StreamingBatchEvent) => void;
  errorGettingBatchEvents: (activity: Activity, batchId: string, error: Error) => void;
};

/**
 * Represents a set of use cases related to managing the lifetime of an activity
 */
export interface IActivityApi {
  getActivity(id: string): Promise<Activity>;

  createActivity(agreement: Agreement): Promise<Activity>;

  destroyActivity(activity: Activity): Promise<Activity>;

  getActivityState(id: string): Promise<ActivityStateEnum>;

  executeScript(activity: Activity, script: ExeScriptRequest): Promise<string>;

  getExecBatchResults(activity: Activity, batchId: string, commandIndex?: number, timeout?: number): Promise<Result[]>;

  getExecBatchEvents(activity: Activity, batchId: string, commandIndex?: number): Observable<StreamingBatchEvent>;
}
