import { Activity, ActivityOptions } from "./activity";
import { defaultLogger, Logger, YagnaApi } from "../utils";
import { AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";

interface ActivityServiceOptions extends ActivityOptions {}

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

  async run() {
    this.isServiceRunning = true;
    this.logger.debug("Activity Pool Service has started");
  }
  async getActivity(): Promise<Activity> {
    if (!this.isServiceRunning) {
      throw new Error("Unable to get activity. Activity service is not running");
    }
    return this.pool.shift() || (await this.createActivity());
  }

  async releaseActivity(activity: Activity, allowReuse: boolean = true) {
    if (allowReuse) {
      this.pool.push(activity);
    } else {
      await activity.stop().catch((e) => this.logger.warn(e));
      await this.agreementService.releaseAgreement(activity.agreement.id, allowReuse);
    }
  }

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
