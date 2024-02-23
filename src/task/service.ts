import { TaskQueue } from "./queue";
import { WorkContext } from "./work";
import { defaultLogger, Logger, sleep, YagnaApi } from "../utils";
import { StorageProvider } from "../storage";
import { Agreement, AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";
import { NetworkNode, NetworkService } from "../network";
import { Activity, ActivityOptions } from "../activity";
import { TaskConfig } from "./config";
import { Events } from "../events";
import { Task } from "./task";

export interface TaskServiceOptions extends ActivityOptions {
  /** Number of maximum parallel running task on one TaskExecutor instance */
  maxParallelTasks?: number;
  taskRunningInterval?: number;
  activityStateCheckingInterval?: number;
  activityPreparingTimeout?: number;
  taskTimeout?: number;
  logger?: Logger;
  storageProvider?: StorageProvider;
}

/**
 * @internal
 */
export class TaskService {
  private activeTasksCount = 0;
  private activities = new Map<string, Activity>();
  private activitySetupDone: Set<string> = new Set();
  private isRunning = false;
  private logger: Logger;
  private options: TaskConfig;

  constructor(
    private yagnaApi: YagnaApi,
    private tasksQueue: TaskQueue,
    private agreementPoolService: AgreementPoolService,
    private paymentService: PaymentService,
    private networkService?: NetworkService,
    options?: TaskServiceOptions,
  ) {
    this.options = new TaskConfig(options);
    this.logger = options?.logger || defaultLogger("work");
  }

  public async run() {
    this.isRunning = true;
    this.logger.info("Task Service has started");
    while (this.isRunning) {
      if (this.activeTasksCount >= this.options.maxParallelTasks) {
        await sleep(this.options.taskRunningInterval, true);
        continue;
      }
      const task = this.tasksQueue.get();
      if (!task) {
        await sleep(this.options.taskRunningInterval, true);
        continue;
      }
      task.onStateChange(() => {
        if (task.isRetry()) {
          this.retryTask(task).catch((error) => this.logger.error(`Issue with retrying a task on Golem`, error));
        } else if (task.isFinished()) {
          this.stopTask(task).catch((error) => this.logger.error(`Issue with stopping a task on Golem`, error));
        }
      });
      this.startTask(task).catch(
        (error) => this.isRunning && this.logger.error(`Issue with starting a task on Golem`, error),
      );
    }
  }

  async end() {
    this.isRunning = false;
    this.logger.debug(`Trying to stop all activities`, { size: this.activities.size });
    await Promise.all(
      [...this.activities.values()].map((activity) =>
        activity
          .stop()
          .catch((error) => this.logger.warn(`Stopping activity failed`, { activityId: activity.id, error })),
      ),
    );
    this.logger.info("Task Service has been stopped");
  }

  private async startTask(task: Task) {
    task.init();
    this.logger.debug(`Starting task`, { taskId: task.id, attempt: task.getRetriesCount() + 1 });
    ++this.activeTasksCount;

    const agreement = await this.agreementPoolService.getAgreement();
    let activity: Activity | undefined;
    let networkNode: NetworkNode | undefined;

    try {
      activity = await this.getOrCreateActivity(agreement);
      task.start(activity, networkNode);
      this.options.eventTarget?.dispatchEvent(
        new Events.TaskStarted({
          id: task.id,
          agreementId: agreement.id,
          activityId: activity.id,
          provider: agreement.getProviderInfo(),
        }),
      );
      this.logger.info(`Task started`, {
        taskId: task.id,
        providerName: agreement.getProviderInfo().name,
        activityId: activity.id,
      });

      const activityReadySetupFunctions = task.getActivityReadySetupFunctions();
      const worker = task.getWorker();
      if (this.networkService && !this.networkService.hasNode(agreement.getProviderInfo().id)) {
        networkNode = await this.networkService.addNode(agreement.getProviderInfo().id);
      }

      const ctx = new WorkContext(activity, {
        yagnaOptions: this.yagnaApi.yagnaOptions,
        activityReadySetupFunctions: this.activitySetupDone.has(activity.id) ? [] : activityReadySetupFunctions,
        storageProvider: this.options.storageProvider,
        networkNode,
        logger: this.logger,
        activityPreparingTimeout: this.options.activityPreparingTimeout,
        activityStateCheckingInterval: this.options.activityStateCheckingInterval,
      });

      await ctx.before();

      if (activityReadySetupFunctions.length && !this.activitySetupDone.has(activity.id)) {
        this.activitySetupDone.add(activity.id);
        this.logger.debug(`Activity setup completed`, { activityId: activity.id });
      }
      const results = await worker(ctx);
      task.stop(results);
    } catch (error) {
      task.stop(undefined, error);
    } finally {
      --this.activeTasksCount;
    }
  }

  private async stopActivity(activity: Activity) {
    await activity.stop();
    this.activities.delete(activity.agreement.id);
  }

  private async getOrCreateActivity(agreement: Agreement) {
    const previous = this.activities.get(agreement.id);
    if (previous) {
      return previous;
    } else {
      const activity = await Activity.create(agreement, this.yagnaApi, this.options);
      this.activities.set(agreement.id, activity);
      this.paymentService.acceptPayments(agreement);
      return activity;
    }
  }

  private async retryTask(task: Task) {
    if (!this.isRunning) return;
    task.cleanup();
    await this.releaseTaskResources(task);
    const reason = task.getError()?.message;
    this.options.eventTarget?.dispatchEvent(
      new Events.TaskRedone({
        id: task.id,
        activityId: task.getActivity()?.id,
        agreementId: task.getActivity()?.agreement.id,
        provider: task.getActivity()?.getProviderInfo(),
        retriesCount: task.getRetriesCount(),
        reason,
      }),
    );
    this.logger.warn(`Task execution failed. Trying to redo the task.`, {
      taskId: task.id,
      attempt: task.getRetriesCount(),
      reason,
    });
    this.tasksQueue.addToBegin(task);
  }

  private async stopTask(task: Task) {
    task.cleanup();
    await this.releaseTaskResources(task);
    if (task.isRejected()) {
      const reason = task.getError()?.message;
      this.options.eventTarget?.dispatchEvent(
        new Events.TaskRejected({
          id: task.id,
          agreementId: task.getActivity()?.agreement.id,
          activityId: task.getActivity()?.id,
          provider: task.getActivity()?.getProviderInfo(),
          reason,
        }),
      );
      this.logger.error(`Task has been rejected`, {
        taskId: task.id,
        reason: task.getError()?.message,
        retries: task.getRetriesCount(),
        providerName: task.getActivity()?.getProviderInfo().name,
      });
    } else {
      this.options.eventTarget?.dispatchEvent(new Events.TaskFinished({ id: task.id }));
      this.logger.info(`Task computed`, {
        taskId: task.id,
        retries: task.getRetriesCount(),
        providerName: task.getActivity()?.getProviderInfo().name,
      });
    }
  }

  private async releaseTaskResources(task: Task) {
    const activity = task.getActivity();
    if (activity) {
      if (task.isFailed()) {
        /**
         * Activity should only be terminated when the task fails.
         * We assume that the next attempt should be performed on a new activity instance.
         * For successfully completed tasks, activities remain in the ready state
         * and are ready to be used for other tasks.
         * For them, termination will be completed with the end of service
         */
        await this.stopActivity(activity).catch((error) =>
          this.logger.error(`Stopping activity failed`, { activityId: activity.id, error }),
        );
      }
      await this.agreementPoolService
        .releaseAgreement(activity.agreement.id, task.isDone())
        .catch((error) =>
          this.logger.error(`Releasing agreement failed`, { agreementId: activity.agreement.id, error }),
        );
    }
    const networkNode = task.getNetworkNode();
    if (this.networkService && networkNode) {
      await this.networkService
        .removeNode(networkNode.id)
        .catch((error) => this.logger.error(`Removing network node failed`, { nodeId: networkNode.id, error }));
    }
  }
}
