/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Agreement } from "../agreement";
import { Promise } from "cypress/types/cy-bluebird";
import { Activity } from "./index";

export interface ActivityEvents {}

export interface ActivityModule {
  events: EventEmitter<ActivityEvents>;

  /**
   * Internally:
   *
   * - Activity.start
   * - Activity.deploy
   * - deploys the image
   * - the resulting ActivityDTO from ya-ts-client should be "Deployed"
   *
   * @return An WorkContext that's fully commissioned and the user can execute their commands
   */
  createActivity(agreement: Agreement): Promise<Activity>;

  /**
   * Resets the activity on the exe unit back to "New" state
   *
   * Internally:
   *
   * - Activity.terminate
   *
   * @return Activity that could be deployed again
   */
  resetActivity(activity: Activity): Promise<Activity>;

  /**
   * Definitely terminate any work on the provider
   *
   * - Activity.destroy
   *
   * @return The activity that was permanently terminated
   */
  destroyActivity(activity: Activity, reason: string): Promise<Activity>;
}

export class ActivityModuleImpl implements ActivityModule {
  events: EventEmitter<ActivityEvents> = new EventEmitter<ActivityEvents>();

  createActivity(_agreement: Agreement): Promise<Activity> {
    throw new Error("Method not implemented.");
  }

  resetActivity(_activity: Activity): Promise<Activity> {
    throw new Error("Method not implemented.");
  }

  destroyActivity(_activity: Activity, _reason: string): Promise<Activity> {
    throw new Error("Method not implemented.");
  }
}