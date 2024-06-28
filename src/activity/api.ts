import { Activity, ActivityStateEnum } from "./activity";
import { Agreement } from "../market";
import { ExeScriptRequest } from "./exe-script-executor";
import { Result, StreamingBatchEvent } from "./results";
import { Observable } from "rxjs";

export type ActivityEvents = {
  activityCreated: (event: { activity: Activity }) => void;
  errorCreatingActivity: (event: { error: Error }) => void;

  activityDestroyed: (event: { activity: Activity }) => void;
  errorDestroyingActivity: (event: { activity: Activity; error: Error }) => void;

  exeUnitInitialized: (event: { activity: Activity }) => void;
  errorInitializingExeUnit: (event: { activity: Activity; error: Error }) => void;

  activityStateChanged: (event: { activity: Activity; previousState: ActivityStateEnum }) => void;
  errorRefreshingActivity: (event: { activity: Activity; error: Error }) => void;

  scriptSent: (event: { activity: Activity; script: ExeScriptRequest }) => void;
  scriptExecuted: (event: { activity: Activity; script: ExeScriptRequest; result: string }) => void;
  errorExecutingScript: (event: { activity: Activity; script: ExeScriptRequest; error: Error }) => void;

  batchResultsReceived: (event: { activity: Activity; batchId: string; results: Result[] }) => void;
  errorGettingBatchResults: (event: { activity: Activity; batchId: string; error: Error }) => void;

  batchEventsReceived: (event: { activity: Activity; batchId: string; event: StreamingBatchEvent }) => void;
  errorGettingBatchEvents: (event: { activity: Activity; batchId: string; error: Error }) => void;
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
