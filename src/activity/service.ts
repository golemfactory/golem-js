import { Activity, ActivityOptions } from "./activity";
import { defaultLogger, Logger, YagnaApi } from "../utils";
import { AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";

interface ActivityServiceOptions extends ActivityOptions {}

/**
 * Activity Pool Service
 * A very simple implementation of the Activity Pool Service that allows to retrieve Activity from the pool.
 * If the pool is empty, a new activity is created using the agreement provided by AgreementPoolService.
 * @hidden
 */
export class ActivityPoolService {
  private logger: Logger;
  private pool: Activity[] = [];
  private isServiceRunning = false;
  constructor(
    private yagnaApi: YagnaApi,
    private agreementService: AgreementPoolService,
    private paymentService: PaymentService,
    private options?: ActivityServiceOptions,
  ) {
    this.logger = this.logger = options?.logger || defaultLogger();
  }

  /**
   * Start ActivityPoolService
   */
  async run() {
    this.isServiceRunning = true;
    this.logger.debug("Activity Pool Service has started");
  }

  /**
   * Get an activity from the pool of available ones or create a new one
   */
  async getActivity(): Promise<Activity> {
    if (!this.isServiceRunning) {
      throw new Error("Unable to get activity. Activity service is not running");
    }
    return this.pool.shift() || (await this.createActivity());
  }

  /**
   * Release the activity back into the pool or if it is not reusable
   * it will be terminated and the agreement will be released
   * @param activity
   * @param allowReuse
   */
  async releaseActivity(activity: Activity, allowReuse: boolean = true) {
    if (allowReuse) {
      this.pool.push(activity);
      this.logger.debug(`Activity ${activity.id} has been released for reuse`);
    } else {
      await activity.stop().catch((e) => this.logger.warn(e));
      await this.agreementService.releaseAgreement(activity.agreement.id, allowReuse);
      this.logger.debug(`Activity ${activity.id} has been released and will be terminated`);
    }
  }

  /**
   * Stop the service and terminate all activities from the pool
   */
  async end() {
    this.isServiceRunning = false;
    this.pool.forEach((activity) => activity.stop().catch((e) => this.logger.warn(e)));
    this.logger.debug("Activity Pool Service has been stopped");
  }

  private async createActivity(): Promise<Activity> {
    const agreement = await this.agreementService.getAgreement();
    this.paymentService.acceptPayments(agreement);
    return Activity.create(agreement, this.yagnaApi, this.options);
  }
}
