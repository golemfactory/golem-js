import { Activity, ActivityStateEnum } from "./activity";
import { Agreement } from "../market/agreement";

/**
 * Represents a set of use cases related to managing the lifetime of an activity
 */
export interface IActivityApi {
  getActivity(id: string): Promise<Activity>;

  createActivity(agreement: Agreement): Promise<Activity>;

  destroyActivity(activity: Activity): Promise<Activity>;

  getActivityState(id: string): Promise<ActivityStateEnum>;

  // executeScript(script: Script, mode: "stream" | "poll"): Promise<Readable>;
}
