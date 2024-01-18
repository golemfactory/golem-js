import { Activity, ActivityOptions } from "./activity";
import { defaultLogger, Logger, YagnaApi } from "../utils";
import { AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";
import { GolemWorkError, WorkErrorCode } from "../task/error";

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
  private runningState = false;

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
    this.runningState = true;
    this.logger.debug("Activity Pool Service has started");
  }

  isRunning() {
    return this.runningState;
  }

  /**
   * Get an activity from the pool of available ones or create a new one
   */
  async getActivity(): Promise<Activity> {
    if (!this.runningState) {
      throw new GolemWorkError(
        "Unable to get activity. Activity service is not running",
        WorkErrorCode.ServiceNotInitialized,
      );
    }
    return this.pool.shift() || (await this.createActivity());
  }

  /**
   * Release the activity back into the pool or if it is not reusable
   * it will be terminated and the agreement will be released
   * @param activity
   * @param reuse - determines whether the activity can be reused or should be terminated
   */
  async releaseActivity(activity: Activity, { reuse } = { reuse: true }) {
    if (reuse) {
      this.pool.push(activity);
      this.logger.debug(`Activity ${activity.id} has been released for reuse`);
    } else {
      await activity.stop().catch((e) => this.logger.warn(e));
      await this.agreementService.releaseAgreement(activity.agreement.id, false);
      this.logger.debug(`Activity ${activity.id} has been released and will be terminated`);
    }
  }

  /**
   * Stop the service and terminate all activities from the pool
   */
  async end() {
    await Promise.all(this.pool.map((activity) => activity.stop().catch((e) => this.logger.warn(e))));
    this.runningState = false;
    this.logger.debug("Activity Pool Service has been stopped");
  }

  private async createActivity(): Promise<Activity> {
    const agreement = await this.agreementService.getAgreement();
    this.paymentService.acceptPayments(agreement);
    return Activity.create(agreement, this.yagnaApi, this.options);
  }
}
