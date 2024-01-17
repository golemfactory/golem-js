import { TaskQueue } from "./queue";
import { WorkContext } from "./work";
import { defaultLogger, Logger, sleep, YagnaApi } from "../utils";
import { StorageProvider } from "../storage";
import { Agreement, AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { Activity, ActivityOptions } from "../activity";
import { TaskConfig } from "./config";
import { Events } from "../events";
import { Task } from "./task";
import { GolemError } from "../error/golem-error";

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
    task.start();
    this.logger.debug(`Starting task`, { taskId: task.id });
    ++this.activeTasksCount;

    const agreement = await this.agreementPoolService.getAgreement();
    let activity: Activity | undefined;

    try {
      activity = await this.getOrCreateActivity(agreement);

      this.options.eventTarget?.dispatchEvent(
        new Events.TaskStarted({
          id: task.id,
          agreementId: agreement.id,
          activityId: activity.id,
          provider: agreement.provider,
        }),
      );

      this.logger.info(`Task sent to provider`, { taskId: task.id, providerName: agreement.provider.name });

      const activityReadySetupFunctions = task.getActivityReadySetupFunctions();
      const worker = task.getWorker();
      const networkNode = await this.networkService?.addNode(agreement.provider.id);

      const ctx = new WorkContext(activity, {
        activityReadySetupFunctions: this.activitySetupDone.has(activity.id) ? [] : activityReadySetupFunctions,
        provider: agreement.provider,
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

      this.options.eventTarget?.dispatchEvent(new Events.TaskFinished({ id: task.id }));
      this.logger.info(`Task computed`, { taskId: task.id, providerName: agreement.provider.name });
    } catch (error) {
      task.stop(undefined, error);

      const reason = error.message || error.toString();
      this.logger.warn(`Starting task failed`, { reason });

      if (task.isRetry() && this.isRunning) {
        this.tasksQueue.addToBegin(task);
        this.options.eventTarget?.dispatchEvent(
          new Events.TaskRedone({
            id: task.id,
            activityId: activity?.id,
            agreementId: agreement.id,
            provider: agreement.provider,
            retriesCount: task.getRetriesCount(),
            reason,
          }),
        );
        this.logger.warn(`Task execution failed. Trying to redo the task.`, {
          taskId: task.id,
          attempt: task.getRetriesCount(),
          reason,
        });
      } else {
        this.options.eventTarget?.dispatchEvent(
          new Events.TaskRejected({
            id: task.id,
            agreementId: agreement.id,
            activityId: activity?.id,
            provider: agreement.provider,
            reason,
          }),
        );
        task.cleanup();
        this.logger.error(`Task has been rejected`, { taskId: task.id, reason });
        throw new GolemError(`Task ${task.id} has been rejected! ${reason}`);
      }

      if (activity) {
        await this.stopActivity(activity, agreement);
      }
    } finally {
      --this.activeTasksCount;
      await this.agreementPoolService
        .releaseAgreement(agreement.id, task.isDone())
        .catch((error) => this.logger.error(`Releasing agreement failed`, { agreementId: agreement.id, error }));
    }
  }

  private async stopActivity(activity: Activity, agreement: Agreement) {
    await activity?.stop();
    this.activities.delete(agreement.id);
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
}
