import { Task } from "./task";
import { TaskQueue } from "./queue";
import { WorkContext } from "./work";
import { Logger, sleep } from "../utils";
import { StorageProvider } from "../storage";
import { AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { Activity, ActivityOptions } from "../activity";
import { TaskConfig } from "./config";
import { Events } from "../events";

export interface TaskOptions extends ActivityOptions {
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
  private initWorkersDone: Set<string> = new Set();
  private isRunning = false;
  private logger?: Logger;
  private options: TaskConfig;

  constructor(
    private tasksQueue: TaskQueue<Task<unknown, unknown>>,
    private agreementPoolService: AgreementPoolService,
    private paymentService: PaymentService,
    private networkService?: NetworkService,
    options?: TaskOptions,
  ) {
    this.options = new TaskConfig(options);
    this.logger = options?.logger;
  }

  public async run() {
    this.isRunning = true;
    this.logger?.debug("Task Service has started");
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
      this.startTask(task).catch((error) => this.isRunning && this.logger?.error(error));
    }
  }

  async end() {
    this.isRunning = false;
    this.logger?.debug(`Trying to stop all activities. Size: ${this.activities.size}`);
    await Promise.all(
      [...this.activities.values()].map((activity) => activity.stop().catch((e) => this.logger?.warn(e.toString()))),
    );
    this.logger?.debug("Task Service has been stopped");
  }

  private async startTask(task: Task) {
    task.start();
    this.logger?.debug(`Starting task. ID: ${task.id}, Data: ${task.getData()}`);
    ++this.activeTasksCount;
    const agreement = await this.agreementPoolService.getAgreement();
    let activity;
    try {
      if (this.activities.has(agreement.id)) {
        activity = this.activities.get(agreement.id);
      } else {
        activity = await Activity.create(agreement.id, this.options);
        this.activities.set(agreement.id, activity);
      }
      this.options.eventTarget?.dispatchEvent(
        new Events.TaskStarted({
          id: task.id,
          agreementId: agreement.id,
          activityId: activity.id,
          providerId: agreement.provider.id,
          providerName: agreement.provider.name,
        }),
      );
      this.logger?.info(
        `Task ${task.id} sent to provider ${agreement.provider.name}.${
          task.getData() ? " Data: " + task.getData() : ""
        }`,
      );
      this.paymentService.acceptDebitNotes(agreement.id);
      this.paymentService.acceptPayments(agreement);
      const initWorker = task.getInitWorker();
      const worker = task.getWorker();
      const data = task.getData();
      const networkNode = await this.networkService?.addNode(agreement.provider.id);
      const ctx = new WorkContext(activity, {
        initWorker: this.initWorkersDone.has(activity.id) ? undefined : initWorker,
        provider: agreement.provider,
        storageProvider: this.options.storageProvider,
        networkNode,
        logger: this.logger,
        activityPreparingTimeout: this.options.activityPreparingTimeout,
        activityStateCheckingInterval: this.options.activityStateCheckingInterval,
        isRunning: () => this.isRunning,
      });
      await ctx.before();
      if (initWorker && !this.initWorkersDone.has(activity.id)) {
        this.initWorkersDone.add(activity.id);
        this.logger?.debug(`Init worker done in activity ${activity.id}`);
      }
      const results = await worker(ctx, data);
      task.stop(results);
      this.options.eventTarget?.dispatchEvent(new Events.TaskFinished({ id: task.id }));
      this.logger?.info(
        `Task ${task.id} computed by provider ${agreement.provider.name}.${
          task.getData() ? " Data: " + task.getData() : ""
        }`,
      );
    } catch (error) {
      task.stop(undefined, error);
      const reason = error?.response?.data?.message || error.message || error.toString();
      this.logger?.warn(`Starting task failed due to this issue: ${reason}`);
      if (task.isRetry() && this.isRunning) {
        this.tasksQueue.addToBegin(task);
        this.options.eventTarget?.dispatchEvent(
          new Events.TaskRedone({
            id: task.id,
            activityId: activity?.id,
            agreementId: agreement.id,
            providerId: agreement.provider.id,
            providerName: agreement.provider.name,
            retriesCount: task.getRetriesCount(),
            reason,
          }),
        );
        this.logger?.warn(
          `Task ${task.id} execution failed. Trying to redo the task. Attempt #${task.getRetriesCount()}. ${reason}`,
        );
      } else {
        this.options.eventTarget?.dispatchEvent(
          new Events.TaskRejected({
            id: task.id,
            agreementId: agreement.id,
            activityId: activity.id,
            providerId: agreement.provider.id,
            providerName: agreement.provider.name,
            reason,
          }),
        );
        throw new Error(`Task ${task.id} has been rejected! ${reason}`);
      }
      await activity?.stop().catch((actError) => this.logger?.debug(actError));
      this.activities.delete(agreement.id);
    } finally {
      --this.activeTasksCount;
    }
    await this.agreementPoolService.releaseAgreement(agreement.id, task.isDone()).catch((e) => this.logger?.debug(e));
  }
}
