import { EventEmitter } from "eventemitter3";
import { Agreement } from "../market";
import { Activity, ActivityEvents, IActivityApi, Result } from "./index";
import { defaultLogger } from "../shared/utils";
import { GolemServices } from "../golem-network";
import { ExeUnit, ExeUnitOptions } from "./exe-unit";
import { ExecutionOptions, ExeScriptExecutor, ExeScriptRequest } from "./exe-script-executor";
import { catchError, Observable, tap } from "rxjs";
import { StreamingBatchEvent } from "./results";

export interface ActivityModule {
  events: EventEmitter<ActivityEvents>;

  /**
   * Create and start a new activity on the provider for the supplied agreement
   *
   * @return The resulting activity on the provider for further use
   */
  createActivity(agreement: Agreement, signalOrTimeout?: AbortSignal | number): Promise<Activity>;

  /**
   * Definitely terminate any work on the provider
   *
   * @return The activity that was permanently terminated
   */
  destroyActivity(activity: Activity, signalOrTimeout?: AbortSignal | number): Promise<Activity>;

  /**
   * Fetches the latest state of the activity. It's recommended to use this method
   * before performing any actions on the activity to make sure it's in the correct state.
   * If the fetched activity's state is different from the one you have, an event will be emitted.
   */
  refreshActivity(staleActivity: Activity): Promise<Activity>;

  /**
   * Fetches the activity by its ID from yagna. If the activity doesn't exist, an error will be thrown.
   */
  findActivityById(activityId: string): Promise<Activity>;

  /**
   * Create a exe-unit "within" the activity so that you can perform commands on the rented resources
   *
   * @return An ExeUnit that's fully commissioned and the user can execute their commands
   */
  createExeUnit(activity: Activity, options?: ExeUnitOptions): Promise<ExeUnit>;

  /**
   * Factory method for creating a script executor for the activity
   */
  createScriptExecutor(activity: Activity, options?: ExecutionOptions): ExeScriptExecutor;

  /**
   * Execute a script on the activity.
   */
  executeScript(activity: Activity, script: ExeScriptRequest): Promise<string>;

  /**
   * Fetch the results of a batch execution.
   */
  getBatchResults(activity: Activity, batchId: string, commandIndex?: number, timeout?: number): Promise<Result[]>;

  /**
   * Create an observable that will emit events from the streaming batch.
   */
  observeStreamingBatchEvents(
    activity: Activity,
    batchId: string,
    commandIndex?: number,
  ): Observable<StreamingBatchEvent>;
}

/**
 * Information about a file that has been published via the FileServer
 */
export type FileServerEntry = {
  /** The URL of the file, that the clients can use to reach and download the file */
  fileUrl: string;

  /** The checksum that can be used by clients to validate integrity of the downloaded file */
  fileHash: string;
};

/**
 * An abstract interface describing a File Server that can be used to expose files from the Requestor to the Golem Network
 */
export interface IFileServer {
  /**
   * Exposes a file that can be accessed via Golem Network and GFTP
   */
  publishFile(sourcePath: string): Promise<FileServerEntry>;

  /**
   * Tells if the file was already published on the server
   */
  isFilePublished(sourcePath: string): boolean;

  /**
   * Returns publishing information for a file that has been already served
   */
  getPublishInfo(sourcePath: string): FileServerEntry | undefined;

  /**
   * Tells if the server is currently serving any files
   */
  isServing(): boolean;
}

export class ActivityModuleImpl implements ActivityModule {
  public readonly events: EventEmitter<ActivityEvents> = new EventEmitter<ActivityEvents>();

  private readonly logger = defaultLogger("activity");

  private readonly activityApi: IActivityApi;

  constructor(private readonly services: GolemServices) {
    this.logger = services.logger;
    this.activityApi = services.activityApi;
  }
  createScriptExecutor(activity: Activity, options?: ExecutionOptions): ExeScriptExecutor {
    return new ExeScriptExecutor(activity, this, this.logger.child("executor"), options);
  }

  async executeScript(activity: Activity, script: ExeScriptRequest): Promise<string> {
    this.logger.debug("Executing script on activity", { activityId: activity.id });
    try {
      this.events.emit("scriptSent", {
        activity,
        script,
      });

      const result = await this.activityApi.executeScript(activity, script);

      this.events.emit("scriptExecuted", {
        activity: await this.refreshActivity(activity).catch(() => {
          this.logger.warn("Failed to refresh activity after script execution", { activityId: activity.id });
          return activity;
        }),
        script,
        result,
      });

      return result;
    } catch (error) {
      this.events.emit("errorExecutingScript", {
        activity: await this.refreshActivity(activity).catch(() => {
          this.logger.warn("Failed to refresh activity after script execution error", { activityId: activity.id });
          return activity;
        }),
        script,
        error,
      });

      throw error;
    }
  }
  async getBatchResults(
    activity: Activity,
    batchId: string,
    commandIndex?: number | undefined,
    timeout?: number | undefined,
  ): Promise<Result[]> {
    this.logger.debug("Fetching batch results", { activityId: activity.id, batchId });
    try {
      const results = await this.activityApi.getExecBatchResults(activity, batchId, commandIndex, timeout);
      this.events.emit("batchResultsReceived", {
        activity: await this.refreshActivity(activity).catch(() => {
          this.logger.warn("Failed to refresh activity after batch results received", { activityId: activity.id });
          return activity;
        }),
        batchId,
        results,
      });
      return results;
    } catch (error) {
      this.events.emit("errorGettingBatchResults", {
        activity: await this.refreshActivity(activity).catch(() => {
          this.logger.warn("Failed to refresh activity after batch results error", { activityId: activity.id });
          return activity;
        }),
        batchId,
        error,
      });
      throw error;
    }
  }
  observeStreamingBatchEvents(
    activity: Activity,
    batchId: string,
    commandIndex?: number | undefined,
  ): Observable<StreamingBatchEvent> {
    this.logger.debug("Observing streaming batch events", { activityId: activity.id, batchId });
    return this.activityApi.getExecBatchEvents(activity, batchId, commandIndex).pipe(
      tap(async (event) => {
        this.events.emit("batchEventsReceived", {
          activity: await this.refreshActivity(activity).catch(() => {
            this.logger.warn("Failed to refresh activity after batch events received", { activityId: activity.id });
            return activity;
          }),
          batchId,
          event,
        });
      }),
      catchError(async (error) => {
        this.events.emit("errorGettingBatchEvents", {
          activity: await this.refreshActivity(activity).catch(() => {
            this.logger.warn("Failed to refresh activity after batch events error", { activityId: activity.id });
            return activity;
          }),
          batchId,
          error,
        });
        throw error;
      }),
    );
  }

  async createActivity(agreement: Agreement, signalOrTimeout?: AbortSignal | number): Promise<Activity> {
    this.logger.debug("Creating activity", {
      agreementId: agreement.id,
      provider: agreement.provider,
    });
    try {
      const activity = await this.activityApi.createActivity(agreement, signalOrTimeout);
      this.events.emit("activityCreated", { activity });
      this.logger.info("Created activity", {
        activityId: activity.id,
        agreementId: agreement.id,
        provider: agreement.provider,
      });
      return activity;
    } catch (error) {
      this.events.emit("errorCreatingActivity", error);
      throw error;
    }
  }

  async destroyActivity(activity: Activity, signalOrTimeout?: AbortSignal | number): Promise<Activity> {
    this.logger.debug("Destroying activity", activity);
    try {
      const updated = await this.activityApi.destroyActivity(activity, signalOrTimeout);
      this.events.emit("activityDestroyed", {
        activity: updated,
      });

      this.logger.info("Destroyed activity", {
        activityId: updated.id,
        agreementId: updated.agreement.id,
        provider: updated.agreement.provider,
      });

      return updated;
    } catch (error) {
      this.events.emit("errorDestroyingActivity", { activity, error });
      throw error;
    }
  }

  async refreshActivity(staleActivity: Activity): Promise<Activity> {
    // logging to debug level to avoid spamming the logs because this method is called frequently
    this.logger.debug("Fetching latest activity state", {
      activityId: staleActivity.id,
      lastState: staleActivity.getState(),
    });
    try {
      const freshActivity = await this.activityApi.getActivity(staleActivity.id);
      if (freshActivity.getState() !== freshActivity.getPreviousState()) {
        this.logger.debug("Activity state changed", {
          activityId: staleActivity.id,
          previousState: freshActivity.getPreviousState(),
          newState: freshActivity.getState(),
        });
        this.events.emit("activityStateChanged", {
          activity: freshActivity,
          previousState: freshActivity.getPreviousState(),
        });
      }
      return freshActivity;
    } catch (error) {
      this.events.emit("errorRefreshingActivity", {
        activity: staleActivity,
        error,
      });
      throw error;
    }
  }

  async findActivityById(activityId: string): Promise<Activity> {
    this.logger.info("Fetching activity by ID", { activityId });
    return await this.activityApi.getActivity(activityId);
  }

  async createExeUnit(activity: Activity, options?: ExeUnitOptions): Promise<ExeUnit> {
    this.logger.debug("Creating exe-unit for activity", { activityId: activity.id });

    const exe = new ExeUnit(activity, this, {
      yagnaOptions: this.services.yagna.yagnaOptions,
      logger: this.logger.child("exe-unit"),
      ...options,
    });

    this.logger.debug("Initializing the exe-unit for activity", { activityId: activity.id });

    try {
      await exe.setup();
      const refreshedActivity = await this.refreshActivity(activity).catch(() => {
        this.logger.warn("Failed to refresh activity after work context initialization", { activityId: activity.id });
        return activity;
      });
      this.events.emit("exeUnitInitialized", {
        activity: refreshedActivity,
      });
      this.logger.info("Initialized exe-unit", {
        activityId: activity.id,
        state: refreshedActivity.getState(),
      });
      return exe;
    } catch (error) {
      this.events.emit("errorInitializingExeUnit", {
        activity: await this.refreshActivity(activity).catch(() => {
          this.logger.warn("Failed to refresh activity after exe-unit initialization error", {
            activityId: activity.id,
          });
          return activity;
        }),
        error,
      });
      throw error;
    }
  }
}
