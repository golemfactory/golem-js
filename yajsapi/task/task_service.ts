import { ActivityFactory } from "../activity";
import { Task } from "./task";
import { Logger, sleep } from "../utils";
import { WorkContext } from "../work";
import { TaskQueue } from "./task_queue";
import { StorageProvider } from "../storage/provider";
import { AgreementPoolService } from "../agreement";
import { PaymentService } from "../payment";
import { NetworkService } from "../network";
import { NodeInfo } from "../props";
import { EventBus } from "../events/event_bus";

const MAX_PARALLEL_TASKS = 5;

export class TaskService {
  private activeTasks = new Set();
  private activities = new Map();
  private activityFactory: ActivityFactory;
  private initWorkersDone: Set<string> = new Set();
  private isRunning = false;

  constructor(
    yagnaOptions: { apiKey: string; apiUrl: string },
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
    this.logger?.debug("Task Service started.");
    while (this.isRunning) {
      await sleep(2);
      if (this.activeTasks.size >= MAX_PARALLEL_TASKS) continue;
      const task = this.tasksQueue.get();
      if (!task) continue;
      this.startTask(task).catch((error) => this.logger?.error(error));
    }
  }

  private async startTask(task: Task<any, any>) {
    task.start();
    // this.eventBus.emit(new events.TaskStarted(agreement.id));
    const agreement = await this.agreementPoolService.get();

    let activity;
    this.paymentService.acceptPayments(agreement.id()); // TODO: move it to payment service reactive for event TaskStarted
    try {
      // TODO: move it to network service reactive for event NewProvider
      const agreement_details = await agreement.details();
      const nodeInfo = <NodeInfo>agreement_details.provider_view().extract(new NodeInfo());
      const providerName = nodeInfo.name.value;
      const providerId = agreement_details.raw_details.offer.providerId;
      let networkNode;
      if (this.networkService) {
        networkNode = await this.networkService.addNode(providerId);
      }

      if (!this.activities.has(agreement.id())) {
        activity = await this.activityFactory.create(agreement.id());
        this.activities.set(agreement.id(), activity.id);
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
      await activity.stop();
      this.activities.delete(agreement.id());
      if (task.isRetry()) this.tasksQueue.addToBegin(task);
      else throw new Error("Task has been rejected! " + error.toString());
    } finally {
      // this.eventBus.emit(new events.TaskFinished(task));
      await this.agreementPoolService.releaseAgreement(agreement.id());
    }
  }

  async end() {
    this.isRunning = false;
    this.logger?.debug("Task Service stopped.");
  }
}
