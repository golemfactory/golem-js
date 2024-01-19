import { Activity, ActivityOptions } from "./activity";
import { ActivityConfig } from "./config";
import { Events } from "../events";
import { YagnaApi } from "../utils";
import { Agreement } from "../agreement";
import { GolemError } from "../error/golem-error";

/**
 * Activity Factory
 * @description Use {@link Activity.create} instead
 * @internal
 */
export class ActivityFactory {
  private readonly options: ActivityConfig;

  constructor(
    private readonly agreement: Agreement,
    private readonly yagnaApi: YagnaApi,
    options?: ActivityOptions,
  ) {
    this.options = new ActivityConfig(options);
  }

  public async create(secure = false): Promise<Activity> {
    try {
      if (secure) {
        throw new GolemError("Not implemented");
      }
      return await this.createActivity();
    } catch (error) {
      const msg = `Unable to create activity: ${error?.response?.data?.message || error}`;
      this.options.logger.error("Unable to create activity", error);
      throw new GolemError(msg);
    }
  }

  private async createActivity(): Promise<Activity> {
    const { data } = await this.yagnaApi.activity.control.createActivity({ agreementId: this.agreement.id });

    const id = typeof data == "string" ? data : data.activityId;

    this.options.logger.debug(`Activity created`, { id });
    this.options.eventTarget?.dispatchEvent(new Events.ActivityCreated({ id, agreementId: this.agreement.id }));

    return new Activity(id, this.agreement, this.yagnaApi, this.options);
  }
}
