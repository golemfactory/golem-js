/* eslint-disable @typescript-eslint/no-unused-vars */
import {EventEmitter} from "eventemitter3";
import {Agreement} from "../agreement";
import {Activity, ActivityOptions, ActivityStateEnum} from "./index";
import {defaultLogger, Logger, YagnaApi} from "../shared/utils";
import {Promise} from "cypress/types/cy-bluebird";
import {Terminate} from "./script";
import {PaymentModule} from "../payment";
import {GolemWorkError, WorkErrorCode} from "./work";

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
  createActivity(agreement: Agreement, options?: ActivityOptions): Promise<Activity>;

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
  destroyActivity(activity: Activity, reason?: string): Promise<Activity>;
}

export class ActivityModuleImpl implements ActivityModule {
  public readonly events: EventEmitter<ActivityEvents> = new EventEmitter<ActivityEvents>();
  private logger: Logger;

  constructor(private readonly yagnaApi: YagnaApi) {
    this.logger = defaultLogger("activity");
  }

  async createActivity(
    paymentModule: PaymentModule,
    agreement: Agreement,
    options?: ActivityOptions,
  ): Promise<Activity> {
    return await Activity.create(agreement, this.yagnaApi, options);
  }

  async resetActivity(activity: Activity): Promise<Activity> {
    const terminateComand = new Terminate();
    await activity.execute(terminateComand.toExeScriptRequest());
    const state = await activity.getState();
    if (state !== ActivityStateEnum.New) {
      throw new GolemWorkError(
        "Unable to reset activity",
        WorkErrorCode.ActivityResetFailed,
        activity.agreement,
        activity,
        activity.getProviderInfo(),
      );
    }
    return activity;
  }

  async destroyActivity(activity: Activity, reason: string): Promise<Activity> {
    throw new Error("Method not implemented.");
  }
}
