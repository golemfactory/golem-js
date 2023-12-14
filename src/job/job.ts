import { TaskState as JobState } from "../task/task";
import { WorkContext, Worker, WorkOptions } from "../task/work";
import { runtimeContextChecker, YagnaApi } from "../utils";
import { AgreementOptions, AgreementPoolService } from "../agreement";
import { MarketService } from "../market";
import { NetworkService } from "../network";
import { PaymentOptions, PaymentService } from "../payment";
import { MarketOptions } from "../market/service";
import { NetworkOptions } from "../network/network";
import { Package, PackageOptions } from "../package";
import { Activity, ActivityOptions } from "../activity";
import { EventEmitter } from "eventemitter3";
import { GftpStorageProvider, NullStorageProvider, StorageProvider, WebSocketBrowserStorageProvider } from "../storage";
import { GolemError } from "../error/golem-error";

export { TaskState as JobState } from "../task/task";

export type RunJobOptions = {
  market?: MarketOptions;
  payment?: PaymentOptions;
  agreement?: AgreementOptions;
  network?: NetworkOptions;
  package?: PackageOptions;
  activity?: ActivityOptions;
  work?: WorkOptions;
};

export interface JobEventsDict {
  /**
   * Emitted immediately after the job is created and initialization begins.
   */
  created: () => void;
  /**
   * Emitted when the job finishes initialization and work begins.
   */
  started: () => void;
  /**
   * Emitted when the job completes successfully and cleanup begins.
   */
  success: () => void;
  /**
   * Emitted when the job fails and cleanup begins.
   */
  error: (error: Error) => void;
  /**
   * Emitted when the job is canceled by the user.
   */
  canceled: () => void;
  /**
   * Emitted when the job finishes cleanup after success, error or cancelation.
   */
  ended: () => void;
}

/**
 * The Job class represents a single self-contained unit of work that can be run on the Golem Network.
 * It is responsible for managing the lifecycle of the work and providing information about its state.
 * It also provides an event emitter that can be used to listen for state changes.
 */
export class Job<Output = unknown> {
  readonly events: EventEmitter<JobEventsDict> = new EventEmitter();
  private abortController = new AbortController();

  public results: Output | undefined;
  public error: Error | undefined;
  public state: JobState = JobState.New;

  /**
   * Create a new Job instance. It is recommended to use {@link GolemNetwork} to create jobs instead of using this constructor directly.
   *
   * @param id
   * @param yagnaApi
   * @param defaultOptions
   */
  constructor(
    public readonly id: string,
    private yagnaApi: YagnaApi,
    private readonly defaultOptions: Partial<RunJobOptions> = {},
  ) {}

  public isRunning() {
    const inProgressStates = [JobState.Pending, JobState.Retry];

    return inProgressStates.includes(this.state);
  }

  /**
   * Run your worker function on the Golem Network. This method will synchronously initialize all internal services and validate the job options. The work itself will be run asynchronously in the background.
   * You can use the {@link Job.events} event emitter to listen for state changes.
   * You can also use {@link Job.waitForResult} to wait for the job to finish and get the results.
   * If you want to cancel the job, use {@link Job.cancel}.
   * If you want to run multiple jobs in parallel, you can use {@link GolemNetwork.createJob} to create multiple jobs and run them in parallel.
   *
   * @param workOnGolem - Your worker function that will be run on the Golem Network.
   * @param options - Configuration options for the job. These options will be merged with the options passed to the constructor.
   */
  startWork(workOnGolem: Worker<Output>, options: RunJobOptions = {}) {
    if (this.isRunning()) {
      throw new GolemError(`Job ${this.id} is already running`);
    }

    const packageOptions = Object.assign({}, this.defaultOptions.package, options.package);
    if (!packageOptions.imageHash && !packageOptions.manifest && !packageOptions.imageTag) {
      throw new GolemError("You must specify either imageHash, imageTag or manifest in package options");
    }

    this.state = JobState.Pending;
    this.events.emit("created");

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

    const packageDescription = Package.create(packageOptions);

    // reset abort controller
    this.abortController = new AbortController();

    this.runWork({
      worker: workOnGolem,
      marketService,
      agreementService,
      networkService,
      paymentService,
      packageDescription,
      options,
      signal: this.abortController.signal,
    })
      .then((results) => {
        this.results = results;
        this.state = JobState.Done;
        this.events.emit("success");
      })
      .catch((error) => {
        this.error = error;
        this.state = JobState.Rejected;
        this.events.emit("error", error);
      })
      .finally(async () => {
        await Promise.all([agreementService.end(), networkService.end(), paymentService.end(), marketService.end()]);
        this.events.emit("ended");
      });
  }

  private async runWork({
    worker,
    marketService,
    agreementService,
    networkService,
    paymentService,
    packageDescription,
    options,
    signal,
  }: {
    worker: Worker<Output>;
    marketService: MarketService;
    agreementService: AgreementPoolService;
    networkService: NetworkService;
    paymentService: PaymentService;
    packageDescription: Package;
    options: RunJobOptions;
    signal: AbortSignal;
  }) {
    if (signal.aborted) {
      this.events.emit("canceled");
      throw new GolemError("Canceled");
    }

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

    const activity = await Activity.create(agreement, this.yagnaApi, options.activity);

    const storageProvider =
      this.defaultOptions.work?.storageProvider || options.work?.storageProvider || this.getDefaultStorageProvider();

    const workContext = new WorkContext(activity, {
      provider: agreement.provider,
      storageProvider,
      networkNode: await networkService.addNode(agreement.provider.id),
      activityPreparingTimeout:
        this.defaultOptions.work?.activityPreparingTimeout || options.work?.activityPreparingTimeout,
      activityStateCheckingInterval:
        this.defaultOptions.work?.activityStateCheckingInterval || options.work?.activityStateCheckingInterval,
    });

    this.events.emit("started");
    await workContext.before();

    const onAbort = async () => {
      await agreementService.releaseAgreement(agreement.id, false);
      await activity.stop();
      this.events.emit("canceled");
    };
    if (signal.aborted) {
      await onAbort();
      throw new GolemError("Canceled");
    }
    signal.addEventListener("abort", onAbort, { once: true });
    return worker(workContext);
  }

  private getDefaultStorageProvider(): StorageProvider {
    if (runtimeContextChecker.isNode) {
      return new GftpStorageProvider();
    }
    if (runtimeContextChecker.isBrowser) {
      return new WebSocketBrowserStorageProvider(this.yagnaApi, {});
    }
    return new NullStorageProvider();
  }

  /**
   * Cancel the job. This method will stop the activity and wait for it to finish.
   * Throws an error if the job is not running.
   */
  async cancel() {
    if (!this.isRunning) {
      throw new GolemError(`Job ${this.id} is not running`);
    }
    this.abortController.abort();
    return new Promise<void>((resolve) => {
      this.events.once("ended", resolve);
    });
  }

  /**
   * Wait for the job to finish and return the results.
   * Throws an error if the job was not started.
   */
  async waitForResult() {
    if (this.state === JobState.Done) {
      return this.results;
    }
    if (this.state === JobState.Rejected) {
      throw this.error;
    }
    if (!this.isRunning()) {
      throw new GolemError(`Job ${this.id} is not running`);
    }
    return new Promise((resolve, reject) => {
      this.events.once("ended", () => {
        if (this.state === JobState.Done) {
          resolve(this.results);
        } else {
          reject(this.error);
        }
      });
    });
  }
}
