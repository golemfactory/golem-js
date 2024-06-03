import { Activity, ActivityStateEnum } from "./activity";
import { Agreement } from "../market/agreement";
import { ExeScriptRequest } from "./exe-script-executor";
import { Result, StreamingBatchEvent } from "./results";
import { Observable } from "rxjs";

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
