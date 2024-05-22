/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Agreement } from "../agreement";
import { Activity, IActivityApi } from "./index";
import { defaultLogger } from "../shared/utils";
import { GolemServices } from "../golem-network/golem-network";
import { WorkContext, WorkOptions } from "./work";

export interface ActivityEvents {}

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
  destroyActivity(activity: Activity, reason?: string): Promise<Activity>;

  /**
   * Create a work context "within" the activity so that you can perform commands on the rented resources
   *
   * @return An WorkContext that's fully commissioned and the user can execute their commands
   */
  createWorkContext(activity: Activity): Promise<WorkContext>;
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
    const activity = await this.activityApi.createActivity(agreement);

    this.logger.info("Created activity", {
      activityId: activity.id,
      agreementId: agreement.id,
      provider: agreement.getProviderInfo(),
    });

    return activity;
  }

  async destroyActivity(activity: Activity, reason: string): Promise<Activity> {
    const updated = await this.activityApi.destroyActivity(activity);

    this.logger.info("Destroyed activity", {
      activityId: updated.id,
      agreementId: updated.agreement.id,
      provider: updated.agreement.getProviderInfo(),
    });

    return updated;
  }

  async createWorkContext(activity: Activity, options?: WorkOptions): Promise<WorkContext> {
    this.logger.debug("Creating work context for activity", { activityId: activity.id });
    const ctx = new WorkContext(
      this.services.activityApi,
      this.services.yagna.activity.control,
      this.services.yagna.activity.exec,
      activity,
      options,
    );

    this.logger.debug("Initializing the exe-unit for activity", { activityId: activity.id });
    await ctx.before();

    return ctx;
  }
}
