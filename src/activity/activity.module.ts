import { EventEmitter } from "eventemitter3";
import { Agreement } from "../market/agreement";
import { Activity, IActivityApi, ActivityEvents } from "./index";
import { defaultLogger } from "../shared/utils";
import { GolemServices } from "../golem-network/golem-network";
import { WorkContext, WorkOptions } from "./work";

export interface ActivityModule {
  events: EventEmitter<ActivityEvents>;

  /**
   * Create and start a new activity on the provider for the supplied agreement
   *
   * @return The resulting activity on the provider for further use
   */
  createActivity(agreement: Agreement): Promise<Activity>;

  /**
   * Definitely terminate any work on the provider
   *
   * @return The activity that was permanently terminated
   */
  destroyActivity(activity: Activity): Promise<Activity>;

  /**
   * Fetches the latest state of the activity. It's recommended to use this method
   * before performing any actions on the activity to make sure it's in the correct state
   */
  fetchActivity(activityId: Activity["id"]): Promise<Activity>;

  /**
   * Create a work context "within" the activity so that you can perform commands on the rented resources
   *
   * @return An WorkContext that's fully commissioned and the user can execute their commands
   */
  createWorkContext(activity: Activity, options?: WorkOptions): Promise<WorkContext>;
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

export interface ActivityModuleOptions {}

export class ActivityModuleImpl implements ActivityModule {
  public readonly events: EventEmitter<ActivityEvents> = new EventEmitter<ActivityEvents>();

  private readonly logger = defaultLogger("activity");

  private readonly activityApi: IActivityApi;

  private readonly fileServer?: IFileServer;

  constructor(
    private readonly services: GolemServices,
    private readonly options: ActivityModuleOptions = {
      fileServer: false,
    },
  ) {
    this.logger = services.logger;
    this.activityApi = services.activityApi;
  }

  async createActivity(agreement: Agreement): Promise<Activity> {
    this.logger.info("Creating activity", {
      agreementId: agreement.id,
      provider: agreement.getProviderInfo(),
    });
    try {
      const activity = await this.activityApi.createActivity(agreement);
      this.events.emit("activityCreated", activity);
      return activity;
    } catch (error) {
      this.events.emit("errorCreatingActivity", error);
      throw error;
    }
  }

  async destroyActivity(activity: Activity): Promise<Activity> {
    this.logger.info("Destroying activity", {
      activityId: activity.id,
      agreementId: activity.agreement.id,
      provider: activity.agreement.getProviderInfo(),
    });
    try {
      const updated = await this.activityApi.destroyActivity(activity);
      this.events.emit("activityDestroyed", updated);
      return updated;
    } catch (error) {
      this.events.emit("errorDestroyingActivity", activity, error);
      throw error;
    }
  }

  async fetchActivity(activityId: Activity["id"]): Promise<Activity> {
    this.logger.info("Fetching activity state", { activityId });
    try {
      const upToDateActivity = await this.activityApi.getActivity(activityId);
      //TODO: ?
      // if (upToDateActivity.getState() !== activity.getState()) {
      //   this.events.emit("activityStateChanged", upToDateActivity, upToDateActivity.getState());
      // }
      return upToDateActivity;
    } catch (error) {
      this.events.emit("errorFetchingActivityState", activityId, error);
      throw error;
    }
  }

  async createWorkContext(activity: Activity, options?: WorkOptions): Promise<WorkContext> {
    this.logger.info("Creating work context for activity", { activityId: activity.id });
    const ctx = new WorkContext(activity, this.services.activityApi, this.services.networkApi, {
      yagnaOptions: this.services.yagna.yagnaOptions,
      logger: this.logger.child("work-context"),
      ...options,
    });

    this.logger.debug("Initializing the exe-unit for activity", { activityId: activity.id });
    try {
      await ctx.before();
      this.events.emit("activityInitialized", activity);
      return ctx;
    } catch (error) {
      this.events.emit("errorInitializingActivity", activity, error);
      throw error;
    }
  }
}
