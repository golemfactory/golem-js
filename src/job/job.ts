import { TaskState as JobState } from "../task/task";
import { WorkContext, WorkOptions, Worker } from "../task/work";
import { YagnaApi } from "../utils";
import { AgreementOptions, AgreementPoolService } from "../agreement";
import { MarketService } from "../market";
import { NetworkService } from "../network";
import { PaymentOptions, PaymentService } from "../payment";
import { MarketOptions } from "../market/service";
import { NetworkOptions } from "../network/network";
import { Package, PackageOptions } from "../package";
import { Activity, ActivityOptions } from "../activity";
export { TaskState as JobState } from "../task/task";

export type RunJobOptions = {
  market?: MarketOptions;
  payment?: PaymentOptions;
  agreement?: AgreementOptions;
  network?: NetworkOptions;
  package: PackageOptions;
  activity?: ActivityOptions;
  work?: WorkOptions;
};

/**
 * State of a computation unit.
 *
 * @description Represents the state of some computation unit. The purpose of this class is to provide a way to check the state, results and error of a computation unit knowing only its id.
 */
export class Job<Output = unknown> {
  public eventTarget = new EventTarget();

  public results: Output | undefined;
  public error: Error | undefined;
  public state: JobState = JobState.New;

  constructor(
    public readonly id: string,
    private yagnaApi: YagnaApi,
    private readonly defaultOptions: Partial<RunJobOptions> = {},
  ) {}

  private _isRunning = false;
  private activity: Activity | null = null;

  public get isRunning() {
    return this._isRunning;
  }

  async startWork(workOnGolem: Worker<undefined, Output>, options: RunJobOptions) {
    if (this.isRunning) {
      throw new Error(`Job ${this.id} is already running`);
    }
    this._isRunning = true;
    this.state = JobState.Pending;
    this.eventTarget.dispatchEvent(new Event("initialized"));

    const agreementService = new AgreementPoolService(this.yagnaApi, {
      ...this.defaultOptions.agreement,
      ...options.agreement,
    });
    const marketService = new MarketService(agreementService, this.yagnaApi, {
      ...this.defaultOptions.market,
      ...options.market,
    });
    const networkService = new NetworkService(this.yagnaApi, { ...this.defaultOptions.network, ...options.network });
    const paymentService = new PaymentService(this.yagnaApi, { ...this.defaultOptions.payment, ...options.payment });

    const packageDescription = Package.create({ ...this.defaultOptions.package, ...options.package });

    try {
      const allocation = await paymentService.createAllocation();

      await Promise.all([
        marketService.run(packageDescription, allocation),
        agreementService.run(),
        networkService.run(),
        paymentService.run(),
      ]);
      const agreement = await agreementService.getAgreement();
      // agreement is created, we can stop listening for new proposals
      await marketService.end();

      paymentService.acceptPayments(agreement);

      this.activity = await Activity.create(agreement.id, this.yagnaApi, options.activity);

      const workContext = new WorkContext(this.activity, {
        provider: agreement.provider,
        storageProvider: this.defaultOptions.work?.storageProvider || options.work?.storageProvider,
        networkNode: await networkService.addNode(agreement.provider.id),
        activityPreparingTimeout:
          this.defaultOptions.work?.activityPreparingTimeout || options.work?.activityPreparingTimeout,
        activityStateCheckingInterval:
          this.defaultOptions.work?.activityStateCheckingInterval || options.work?.activityStateCheckingInterval,
      });

      this.eventTarget.dispatchEvent(new Event("started"));
      await workContext.before();
      const results = await workOnGolem(workContext);
      this.results = results;
      this.state = JobState.Done;
      this.eventTarget.dispatchEvent(new Event("success"));
    } catch (error) {
      this.error = error;
      this.state = JobState.Rejected;
      this.eventTarget.dispatchEvent(new Event("error"));
    } finally {
      this._isRunning = false;
      await Promise.all([agreementService.end(), networkService.end(), paymentService.end(), marketService.end()]);
      this.eventTarget.dispatchEvent(new Event("ended"));
    }
  }

  async cancel() {
    if (!this.isRunning || !this.activity) {
      throw new Error(`Job ${this.id} is not running`);
    }
    await this.activity.stop();
  }

  async waitForResult() {
    if (!this.isRunning) {
      throw new Error(`Job ${this.id} is not running`);
    }
    if (this.state === JobState.Done) {
      return this.results;
    }
    if (this.state === JobState.Rejected) {
      throw this.error;
    }
    return new Promise((resolve, reject) => {
      this.eventTarget.addEventListener("success", () => {
        resolve(this.results);
      });
      this.eventTarget.addEventListener("error", () => {
        reject(this.error);
      });
    });
  }
}
