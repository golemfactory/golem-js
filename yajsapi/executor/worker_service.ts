// TMP:
let maxParallelTasks, WorkContext, sleep, events;

class WorkerService {
  private isRunning;
  private agreementPool;
  private eventBus;
  private activityFactory;
  private paymentsService;
  private tasksQueue;
  private activeTasks = new Set();
  private activities = new Map();
  private logger;

  public add(task) {
    this.tasksQueue.add(task);
  }

  public async run() {
    while (this.isRunning) {
      const task = this.tasksQueue.get();
      if (!task || this.activeTasks.size >= maxParallelTasks) continue;
      this.startTask(task).catch((error) => this.logger(error));
      await sleep(2);
    }
  }

  private async startTask(task) {
    const agreement = await this.agreementPool.get();
    this.eventBus.emit(new events.TaskStarted({ agr_id: agreement.id }));
    let activity;
    if (!this.activities.has(agreement.id)) {
      activity = this.activityFactory.create(agreement.id);
      this.activities.set(agreement.id, activity.id);
      this.eventBus.emit(new events.ActivityCreated({ act_id: activity.id, agr_id: agreement.id }));
    } else {
      activity = this.activities.get(agreement.id);
      this.eventBus.emit(new events.ActivityReused({ act_id: activity.id, agr_id: agreement.id }));
    }
    this.paymentsService.acceptDebitNotesFor(agreement.id);
    const workContext = new WorkContext(agreement, activity, task);
    await workContext.before();
    await workContext.execute();
    this.paymentsService.acceptInvoicesFor(agreement.id);
    await this.agreementPool.releaseAgreement(agreement.id);
    this.eventBus.emit(new events.TaskFinished({ task }));
  }
}

// USAGE EXAMPLE:
const workerService = new WorkerService();

// in executor init:
workerService.run();

// executor.run(task):
workerService.add({ simple_task_1: true });
workerService.add({ simple_task_2: true });
workerService.add({ simple_task_3: true });

