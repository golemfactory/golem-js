import { Activity, ActivityOptions } from "./activity";
import { ActivityConfig } from "./config";
import { Events } from "../events";

export class ActivityFactory {
  private readonly options: ActivityConfig;

  /**
   * Creating ActivityFactory
   * @param agreementId
   * @param options - ActivityOptions
   * @param options.yagnaOptions.apiKey - Yagna Api Key
   * @param options.yagnaOptions.basePath - Yagna base path to Activity REST Api
   * @param options.requestTimeout - timeout for sending and creating batch
   * @param options.executeTimeout - timeout for executing batch
   * @param options.exeBatchResultsFetchInterval - interval for fetching batch results while polling
   * @param options.logger - logger module
   * @param options.taskPackage
   */
  constructor(private readonly agreementId: string, options?: ActivityOptions) {
    this.options = new ActivityConfig(options);
  }

  /**
   * Create activity for given agreement ID
   * @param secure defines if activity will be secure type
   */
  public async create(secure = false): Promise<Activity> {
    try {
      if (secure) {
        throw new Error("Not implemented");
      }
      return this.createActivity(this.agreementId, this.options);
    } catch (error) {
      throw error?.response?.data?.message || error;
    }
  }

  private async createActivity(agreementId: string, options: ActivityConfig): Promise<Activity> {
    const { data } = await this.options.api.control.createActivity({ agreementId });
    const id = typeof data == "string" ? data : data.activityId;
    this.options.logger?.debug(`Activity ${id} created`);
    this.options.eventTarget?.dispatchEvent(new Events.ActivityCreated({ id, agreementId }));
    return new Activity(id, agreementId, options);
  }
}
