/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { Agreement, IActivityApi } from "../agreement";
import { Activity } from "./index";
import { defaultLogger, YagnaApi } from "../shared/utils";
import { GolemServices } from "../golem-network";
import { WorkContext, WorkOptions } from "./work";

export interface ActivityEvents {}

export interface ActivityModule {
  events: EventEmitter<ActivityEvents>;

  /**
   * Internally:
   *
   * - Activity.start
   * - Activity.deploy
   * - deploys the image
   * - the resulting ActivityDTO from ya-ts-client should be "Deployed"
   *
   * @return An WorkContext that's fully commissioned and the user can execute their commands
   */
  createActivity(agreement: Agreement): Promise<Activity>;

  /**
   * Definitely terminate any work on the provider
   *
   * - Activity.destroy
   *
   * @return The activity that was permanently terminated
   */
  destroyActivity(activity: Activity, reason?: string): Promise<Activity>;

  createWorkContext(activity: Activity): Promise<WorkContext>;
}

export type FileEntry = {
  fileUrl: string;
  fileHash: string;
};

export interface IFileServer {
  /**
   * Exposes a file that can be accessed via Golem Network and GFTP
   */
  publishFile(sourcePath: string): Promise<FileEntry>;

  /**
   * Tells if the file was already published on the server
   */
  isFilePublished(sourcePath: string): boolean;

  /**
   * Returns publishing information for a file that has been already served
   */
  getPublishInfo(sourcePath: string): FileEntry | undefined;

  /**
   * Tells if the server is currentrly serving any files
   */
  isServing(): boolean;
}

export interface ActivityModuleOptions {
  fileServer: boolean;
}

export class ActivityModuleImpl implements ActivityModule {
  public readonly events: EventEmitter<ActivityEvents> = new EventEmitter<ActivityEvents>();

  private readonly yagnaApi: YagnaApi;

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
    this.yagnaApi = services.yagna;
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

  public async startFileServer() {}

  public async stopFileServer() {}

  public async usesFileServer() {
    return this.options.fileServer && this.fileServer !== undefined;
  }
}
