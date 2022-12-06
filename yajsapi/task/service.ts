import { Task, WorkContext, TaskQueue } from "./";
import { Logger, sleep } from "../utils";
import { StorageProvider } from "../storage/provider";
import { AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { Activity, ActivityOptions } from "../activity";
import { TaskConfig } from "./config";

export interface TaskOptions extends ActivityOptions {
  maxParallelTasks?: number;
  taskRunningInterval?: number;
  activityStateCheckingInterval?: number;
  timeout?: number;
  logger?: Logger;
  storageProvider?: StorageProvider;
}

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
    options?: TaskOptions
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
      this.startTask(task).catch((error) => this.logger?.error(error));
    }
  }

  async end() {
    this.isRunning = false;
    for (const activity of this.activities.values()) await activity.stop().catch((e) => this.logger?.error(e));
    this.logger?.debug("Task Service has been stopped");
  }

  private async startTask(task: Task) {
    task.start();
    ++this.activeTasksCount;
    const agreement = await this.agreementPoolService.getAgreement();
    let activity;
    try {
      if (this.activities.has(agreement.id)) {
        activity = this.activities.get(agreement.id);
      } else {
        activity = await Activity.create(agreement.id, { logger: this.logger });
        this.activities.set(agreement.id, activity);
        this.logger?.debug(`Activity ${activity.id} created`);
      }
      this.paymentService.acceptDebitNotes(agreement.id);
      const initWorker = task.getInitWorker();
      const worker = task.getWorker();
      const data = task.getData();
      const networkNode = await this.networkService?.addNode(agreement.provider.id);
      const ctx = new WorkContext(activity, {
        initWorker: initWorker,
        provider: agreement.provider,
        storageProvider: this.options.storageProvider,
        networkNode,
        logger: this.logger,
        activityStateCheckingInterval: this.options.activityStateCheckingInterval,
        timeout: this.options.timeout,
      });
      await ctx.before();
      if (initWorker && !this.initWorkersDone.has(activity.id)) {
        this.initWorkersDone.add(activity.id);
        this.logger?.debug(`Init worker done in activity ${activity.id}`);
      }
      const results = await worker(ctx, data);
      task.stop(results);
    } catch (error) {
      task.stop(undefined, error);
      if (task.isRetry()) {
        this.tasksQueue.addToBegin(task);
        this.logger?.warn("The task execution failed. Trying to redo the task. " + error);
      } else {
        await activity.stop().catch((actError) => this.logger?.error(actError));
        this.activities.delete(agreement.id);
        await this.agreementPoolService.releaseAgreement(agreement.id, false);
        throw new Error("Task has been rejected! " + (error.message || error.toString()));
      }
    } finally {
      --this.activeTasksCount;
      this.paymentService.acceptPayments(agreement);
    }
    await this.agreementPoolService.releaseAgreement(agreement.id, true);
  }
}
