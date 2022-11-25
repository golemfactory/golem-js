import { ActivityFactory } from "../activity";
import { Task } from "./task";
import { Logger, sleep } from "../utils";
import { WorkContext } from "../work";
import { TaskQueue } from "./task_queue";
import { StorageProvider } from "../storage/provider";
import { AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { EventBus } from "../events/event_bus";
import { YagnaOptions } from "../executor";

const MAX_PARALLEL_TASKS = 5;

export class TaskService {
  private activeTasks = new Set();
  private activities = new Map();
  private activityFactory: ActivityFactory;
  private initWorkersDone: Set<string> = new Set();
  private isRunning = false;

  constructor(
    yagnaOptions: YagnaOptions,
    private tasksQueue: TaskQueue<Task<any, any>>,
    private eventBus: EventBus,
    private agreementPoolService: AgreementPoolService,
    private paymentService: PaymentService,
    private storageProvider?: StorageProvider,
    private networkService?: NetworkService,
    private logger?: Logger
  ) {
    this.activityFactory = new ActivityFactory(yagnaOptions.apiKey);
  }

  public async run() {
    this.isRunning = true;
    this.logger?.debug("Task Service has started");
    while (this.isRunning) {
      await sleep(2);
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
    // this.eventBus.emit(new events.TaskStarted(agreement.id));
    const agreement = await this.agreementPoolService.getAgreement();

    let activity;
    this.paymentService.acceptPayments(agreement.id); // TODO: move it to payment service reactive for event TaskStarted
    try {
      // TODO: move it to network service reactive for event NewProvider
      const providerName = agreement.getProviderInfo().providerName;
      const providerId = agreement.getProviderInfo().providerId;
      let networkNode;
      if (this.networkService) {
        networkNode = await this.networkService.addNode(providerId);
      }

      if (!this.activities.has(agreement.id)) {
        activity = await this.activityFactory.create(agreement.id);
        this.logger?.debug(`Activity ${activity.id} created`);
        this.activities.set(agreement.id, activity.id);
        // this.eventBus.emit(new events.ActivityCreated(activity.id, agreement.id));
      } else {
        activity = this.activities.get(agreement.id);
        // this.eventBus.emit(new events.ActivityReused(activity.id, agreement.id));
      }
      const ctx = new WorkContext(
        agreement,
        activity,
        task,
        { providerId, providerName },
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
