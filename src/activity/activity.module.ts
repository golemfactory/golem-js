/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Agreement, IActivityApi } from "../agreement";
import { Activity, ActivityOptions } from "./index";
import { defaultLogger, YagnaApi } from "../shared/utils";
import { GolemServices } from "../golem-network";
import { WorkContext, WorkOptions } from "./work";

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
   * Definitely terminate any work on the provider
   *
   * - Activity.destroy
   *
   * @return The activity that was permanently terminated
   */
  destroyActivity(activity: Activity, reason?: string): Promise<Activity>;

  createWorkContext(activity: Activity): Promise<WorkContext>;
}

export class ActivityModuleImpl implements ActivityModule {
  public readonly events: EventEmitter<ActivityEvents> = new EventEmitter<ActivityEvents>();

  private readonly yagnaApi: YagnaApi;

  private readonly logger = defaultLogger("activity");

  private readonly activityApi: IActivityApi;

  constructor(private readonly services: GolemServices) {
    this.logger = services.logger;
    this.yagnaApi = services.yagna;
    this.activityApi = services.activityApi;
  }

  async createActivity(agreement: Agreement, options?: ActivityOptions): Promise<Activity> {
    const activity = await this.activityApi.createActivity(agreement);

    this.logger.info("Created activity", {
      activityId: activity.id,
      agreementId: agreement.id,
      provider: agreement.getProviderInfo(),
    });

    return activity;
  }

  async destroyActivity(activity: Activity, reason: string): Promise<Activity> {
    const updated = await this.activityApi.destroyActivity(activity);

    this.logger.info("Destroyed activity", {
      activityId: updated.id,
      agreementId: updated.agreement.id,
      provider: updated.agreement.getProviderInfo(),
    });

    return updated;
  }

  async createWorkContext(activity: Activity, options?: WorkOptions): Promise<WorkContext> {
    this.logger.debug("Creating work context for activity", { activityId: activity.id });
    const ctx = new WorkContext(
      this.services.activityApi,
      this.services.yagna.activity.control,
      this.services.yagna.activity.exec,
      activity,
      options,
    );

    this.logger.debug("Initializing the exe-unit for activity", { activityId: activity.id });
    await ctx.before();

    return ctx;
  }
}
