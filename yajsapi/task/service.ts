import { Task, WorkContext, TaskQueue } from "./";
import { Logger } from "../utils";
import { StorageProvider } from "../storage/provider";
import { AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { YagnaOptions } from "../executor";
import { Activity } from "../activity";

const MAX_PARALLEL_TASKS = 5;

export interface TaskOptions {
  yagnaOptions?: YagnaOptions;
}

export class TaskService {
  private activeTasks = new Set();
  private activities = new Map();
  private initWorkersDone: Set<string> = new Set();
  private isRunning = false;

  constructor(
    private tasksQueue: TaskQueue<Task>,
    private agreementPoolService: AgreementPoolService,
    private paymentService: PaymentService,
    private logger?: Logger,
    options?: TaskOptions,
    private networkService?: NetworkService,
    private storageProvider?: StorageProvider
  ) {}

  public async run() {
    this.isRunning = true;
    this.logger?.debug("Task Service has started");
    while (this.isRunning) {
      if (this.activeTasks.size >= MAX_PARALLEL_TASKS) continue;
      const task = this.tasksQueue.get();
      if (!task) continue;
      this.startTask(task).catch((error) => this.logger?.error(error));
    }
  }

  async end() {
    this.isRunning = false;
    this.logger?.debug("Task Service has been stopped");
  }

  private async startTask(task: Task<any, any>) {
    task.start();
    const agreement = await this.agreementPoolService.getAgreement();

    let activity;
    this.paymentService.acceptPayments(agreement.id); // TODO: move it to payment service reactive for event TaskStarted
    try {
      // TODO: move it to network service reactive for event NewProvider
      const networkNode = await this.networkService?.addNode(agreement.provider.id);

      if (this.activities.has(agreement.id)) {
        activity = this.activities.get(agreement.id);
      } else {
        activity = await Activity.create(agreement.id);
        this.activities.set(agreement.id, activity.id);
        this.logger?.debug(`Activity ${activity.id} created`);
      }
      const ctx = new WorkContext(
        agreement,
        activity,
        task,
        agreement.provider,
        this.storageProvider,
        networkNode,
        this.logger
      );
      const worker = task.getWorker();
      const data = task.getData();
      if (!this.initWorkersDone.has(activity.id)) {
        await ctx.before();
        this.initWorkersDone.add(activity.id);
      }
      const results = await worker(ctx, data);
      task.stop(results);
    } catch (error) {
      task.stop(null, error);
      if (task.isRetry()) {
        this.tasksQueue.addToBegin(task);
        this.logger?.warn("The task execution failed. Trying to redo the task. " + error);
      } else {
        await this.agreementPoolService.releaseAgreement(agreement.id, false);
        throw new Error("Task has been rejected! " + error.toString());
      }
    } finally {
      await activity.stop().catch((actError) => this.logger?.error(actError));
      this.activities.delete(agreement.id);
      this.logger?.debug(`Activity ${activity.id} deleted`);
    }
    await this.agreementPoolService.releaseAgreement(agreement.id, true);
  }
}
