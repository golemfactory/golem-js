/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Agreement } from "../agreement";
import { Activity, ActivityOptions, ActivityStateEnum } from "./index";
import { defaultLogger, Logger, YagnaApi } from "../shared/utils";
import { Terminate } from "./script";
import { GolemWorkError, WorkErrorCode } from "./work";
import { GolemServices } from "../golem-network";

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

  private readonly yagnaApi: YagnaApi;

  private readonly logger = defaultLogger("activity");

  constructor(deps: GolemServices) {
    this.logger = deps.logger;
    this.yagnaApi = deps.yagna;
  }

  async createActivity(agreement: Agreement, options?: ActivityOptions): Promise<Activity> {
    const activity = await Activity.create(agreement, this.yagnaApi, options);

    this.logger.info("Created activity", {
      activityId: activity.id,
      agreementId: agreement.id,
      provider: agreement.getProviderInfo(),
    });

    return activity;
  }

  async resetActivity(activity: Activity): Promise<Activity> {
    const terminateCommand = new Terminate();
    await activity.execute(terminateCommand.toExeScriptRequest());
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
    await activity.stop();

    this.logger.info("Destroyed activity", {
      activityId: activity.id,
      agreementId: activity.agreement.id,
      provider: activity.agreement.getProviderInfo(),
    });

    return activity;
  }
}
