import { Task, WorkContext, TaskQueue } from './index.js';
import { Logger, sleep } from '../utils/index.js';
import { StorageProvider } from '../storage/index.js';
import { AgreementPoolService } from '../agreement/index.js';
import { PaymentService } from '../payment/index.js';
import { NetworkService } from '../network/index.js';
import { Activity, ActivityOptions } from '../activity/index.js';
import { TaskConfig } from './config.js';
import { Events } from '../events/index.js';

export interface TaskOptions extends ActivityOptions {
  /** Number of maximum parallel running task on one TaskExecutor instance */
  maxParallelTasks?: number;
  taskRunningInterval?: number;
  activityStateCheckingInterval?: number;
  taskTimeout?: number;
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
      this.startTask(task).catch((error) => this.isRunning && this.logger?.error(error));
    }
  }

  async end() {
    this.isRunning = false;
    for (const activity of this.activities.values()) await activity.stop().catch((e) => this.logger?.error(e));
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
        new Events.TaskStarted({ id: task.id, agreementId: agreement.id, activityId: activity.id })
      );
      this.logger?.info(`Task ${task.id} sent to provider ${agreement.provider.name}. Data: ${task.getData()}`);
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
        workTimeout: this.options.taskTimeout,
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
      this.logger?.info(`Task ${task.id} computed by provider ${agreement.provider.name}. Data: ${task.getData()}`);
    } catch (error) {
      task.stop(undefined, error);
      if (task.isRetry() && this.isRunning) {
        this.tasksQueue.addToBegin(task);
        this.options.eventTarget?.dispatchEvent(
          new Events.TaskRedone({ id: task.id, retriesCount: task.getRetriesCount() })
        );
        this.logger?.warn(
          `Task ${task.id} execution failed. Trying to redo the task. Attempt #${task.getRetriesCount()}. ${error}`
        );
      } else {
        await activity.stop().catch((actError) => this.logger?.error(actError));
        this.activities.delete(agreement.id);
        await this.agreementPoolService.releaseAgreement(agreement.id, false);
        const reason = error.message || error.toString();
        this.options.eventTarget?.dispatchEvent(new Events.TaskRejected({ id: task.id, reason }));
        throw new Error(`Task ${task.id} has been rejected! ${reason}`);
      }
    } finally {
      --this.activeTasksCount;
      this.paymentService.acceptPayments(agreement);
    }
    await this.agreementPoolService.releaseAgreement(agreement.id, true);
  }
}
