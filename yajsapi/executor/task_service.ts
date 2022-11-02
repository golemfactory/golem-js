import { ActivityFactory } from "../activity";
import { Task } from "./task_new";
import { Logger, sleep } from "../utils";
import * as events from "./events";
import { Agreement, WorkContext } from "./work_context";
import { EventBus } from "./eventBus";
import { TaskQueue } from "./taskQueue";
import { StorageProvider } from "../storage/provider";
import { NetworkNode } from "../network";

const MAX_PARALLEL_TASKS = 5;

interface AgreementPool {
  get: () => Promise<Agreement>;
  releaseAgreement: (agreementId: string) => Promise<void>;
}

export class TaskService {
  private activeTasks = new Set();
  private activities = new Map();
  private activityFactory: ActivityFactory;
  private initWorkersDone: Set<string> = new Set();

  constructor(
    apiKey: string,
    private isRunning: boolean,
    private tasksQueue: TaskQueue,
    private agreementPool: AgreementPool,
    private eventBus: EventBus,
    private storageProvider?: StorageProvider,
    private networkNode?: NetworkNode,
    private logger?: Logger
  ) {
    this.activityFactory = new ActivityFactory(apiKey);
  }

  public async run() {
    while (this.isRunning) {
      await sleep(2);
      if (this.activeTasks.size >= MAX_PARALLEL_TASKS) continue;
      const task = this.tasksQueue.get();
      if (!task) continue;
      this.startTask(task).catch((error) => this.logger?.error(error));
    }
  }

  private async startTask(task: Task) {
    // this.eventBus.emit(new events.TaskStarted(agreement.id));
    const agreement = await this.agreementPool.get();
    try {
      let activity;
      if (!this.activities.has(agreement.id)) {
        activity = await this.activityFactory.create(agreement.id);
        this.activities.set(agreement.id, activity.id);
        // this.eventBus.emit(new events.ActivityCreated(activity.id, agreement.id));
      } else {
        activity = this.activities.get(agreement.id);
        // this.eventBus.emit(new events.ActivityReused(activity.id, agreement.id));
      }
      const ctx = new WorkContext(agreement, activity, task, this.storageProvider, this.networkNode, this.logger);
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
      if (task.isRetry()) this.tasksQueue.add(task);
      else throw new Error("Task has been rejected! " + error.toString());
    } finally {
      // this.eventBus.emit(new events.TaskFinished(task));
      await this.agreementPool.releaseAgreement(agreement.id);
    }
  }
}
