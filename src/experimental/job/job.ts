import { Worker, WorkOptions } from "../../activity/work";
import { LegacyAgreementServiceOptions } from "../../agreement";
import { DemandSpec } from "../../market";
import { NetworkOptions } from "../../network";
import { PaymentModuleOptions } from "../../payment";
import { EventEmitter } from "eventemitter3";
import { GolemAbortError, GolemUserError } from "../../shared/error/golem-error";
import { GolemNetwork } from "../../golem-network";
import { Logger } from "../../shared/utils";
import { ActivityDemandDirectorConfigOptions } from "../../market/demand/options";

export enum JobState {
  New = "new",
  Queued = "queued",
  Pending = "pending",
  Done = "done",
  Retry = "retry",
  Rejected = "rejected",
}

export type RunJobOptions = {
  payment?: PaymentModuleOptions;
  agreement?: LegacyAgreementServiceOptions;
  network?: NetworkOptions;
  activity?: ActivityDemandDirectorConfigOptions;
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
 * @experimental This API is experimental and subject to change. Use at your own risk.
 *
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
   * @param id
   * @param glm
   * @param demandSpec
   * @param logger
   */
  constructor(
    public readonly id: string,
    private readonly glm: GolemNetwork,
    private readonly demandSpec: DemandSpec,
    private readonly logger: Logger,
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
   */
  startWork(workOnGolem: Worker<Output>) {
    this.logger.debug("Staring work in a Job");
    if (this.isRunning()) {
      throw new GolemUserError(`Job ${this.id} is already running`);
    }

    this.state = JobState.Pending;
    this.events.emit("created");

    // reset abort controller
    this.abortController = new AbortController();

    this.runWork({
      worker: workOnGolem,
      signal: this.abortController.signal,
    })
      .then((results) => {
        this.logger.debug("Finished work in job", { results });
        this.results = results;
        this.state = JobState.Done;
        this.events.emit("success");
      })
      .catch((error) => {
        this.logger.error("Running work in job failed due to", error);
        this.error = error;
        this.state = JobState.Rejected;
        this.events.emit("error", error);
      })
      .finally(async () => {
        this.events.emit("ended");
      });
  }

  private async runWork({ worker, signal }: { worker: Worker<Output>; signal: AbortSignal }) {
    if (signal.aborted) {
      this.events.emit("canceled");
      throw new GolemAbortError("Canceled");
    }

    const lease = await this.glm.oneOf(this.demandSpec);

    const workContext = await lease.getExeUnit();
    this.events.emit("started");

    const onAbort = async () => {
      await lease.finalize();
      this.events.emit("canceled");
    };

    if (signal.aborted) {
      await onAbort();
      throw new GolemAbortError("Canceled");
    }

    signal.addEventListener("abort", onAbort, { once: true });

    return worker(workContext);
  }

  /**
   * Cancel the job. This method will stop the activity and wait for it to finish.
   * Throws an error if the job is not running.
   */
  async cancel() {
    if (!this.isRunning) {
      throw new GolemUserError(`Job ${this.id} is not running`);
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
      throw new GolemUserError(`Job ${this.id} is not running`);
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
