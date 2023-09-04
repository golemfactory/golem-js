import { Activity, ActivityOptions } from "./activity";
import { ActivityConfig } from "./config";
import { Events } from "../events";
import { YagnaApi } from "../utils/yagna/yagna";

/**
 * Activity Factory
 * @description Use {@link Activity.create} instead
 * @internal
 */
export class ActivityFactory {
  private readonly options: ActivityConfig;

  /**
   * Creating ActivityFactory
   *
   * @param agreementId
   * @param yagnaApi - {@link YagnaApi}
   * @param options - {@link ActivityOptions}
   */
  constructor(
    private readonly agreementId: string,
    private readonly yagnaApi: YagnaApi,
    options?: ActivityOptions,
  ) {
    this.options = new ActivityConfig(options);
  }

  /**
   * Create activity for given agreement ID
   *
   * @param secure defines if activity will be secure type
   * @return {@link Activity}
   * @throws {@link Error} if activity could not be created
   */
  public async create(secure = false): Promise<Activity> {
    try {
      if (secure) {
        throw new Error("Not implemented");
      }
      return this.createActivity();
    } catch (error) {
      const msg = `Unable to create activity: ${error?.response?.data?.message || error}`;
      this.options.logger?.error(msg);
      throw new Error(msg);
    }
  }

  private async createActivity(): Promise<Activity> {
    const { data } = await this.yagnaApi.activity.control.createActivity({ agreementId: this.agreementId });
    const id = typeof data == "string" ? data : data.activityId;
    this.options.logger?.debug(`Activity ${id} created`);
    this.options.eventTarget?.dispatchEvent(new Events.ActivityCreated({ id, agreementId: this.agreementId }));
    return new Activity(id, this.agreementId, this.yagnaApi, this.options);
  }
}