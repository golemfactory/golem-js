// TMP:
let maxParallelTasks, WorkContext, sleep, events;

class TaskService {
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
    this.eventBus.emit(new events.TaskStarted(agreement.id));
    let activity;
    if (!this.activities.has(agreement.id)) {
      activity = await this.activityFactory.create(agreement.id);
      this.activities.set(agreement.id, activity.id);
      this.eventBus.emit(new events.ActivityCreated(activity.id, agreement.id));
    } else {
      activity = this.activities.get(agreement.id);
      this.eventBus.emit(new events.ActivityReused(activity.id, agreement.id));
    }
    this.paymentsService.acceptDebitNotesFor(agreement.id);
    const workContext = new WorkContext(agreement, activity, task);
    await workContext.before();
    await workContext.execute();
    this.paymentsService.acceptInvoicesFor(agreement.id);
    await this.agreementPool.releaseAgreement(agreement.id);
    this.eventBus.emit(new events.TaskFinished(task));
  }
}

// USAGE EXAMPLE:
const taskService = new TaskService();

// in executor init:
taskService.run();

// executor.run(task):
taskService.add({ simple_task_1: true });
taskService.add({ simple_task_2: true });
taskService.add({ simple_task_3: true });
