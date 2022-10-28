import { sleep } from "../utils";
import * as events from "./events";

let isRunning, workersQueue, maxWorkers, agreementPool, eventBus, activityFactory, paymentsService, WorkContext;

class WorkerService {
  private workersQueue;
  private activeWorkers = new Set();
  private activities = new Map();

  public get() {
    // TODO: get worker from queue
  }
  public add() {
    // TODO: add task/worker to queue
  }
  public async run() {
    while (isRunning) {
      await sleep(2);
      const worker = workersQueue.get();
      if (!worker || this.activeWorkers.size >= maxWorkers) continue;
      const agreement = await agreementPool.get();
      eventBus.emit(new events.WorkerStarted({ agr_id: agreement.id }));
      let activity;
      if (!this.activities.has(agreement.id)) {
        activity = activityFactory.create(agreement.id);
        this.activities.set(agreement.id, activity.id);
        eventBus.emit(new events.ActivityCreated({ act_id: activity.id, agr_id: agreement.id }));
      } else {
        activity = this.activities.get(agreement.id);
        eventBus.emit(new events.ActivityReused({ act_id: activity.id, agr_id: agreement.id }));
      }
      paymentsService.acceptDebitNotesFor(agreement.id);
      const workContext = new WorkContext(agreement, activity, worker);
      await workContext.before();
      await workContext.execute();
      paymentsService.acceptInvoicesFor(agreement.id);
      await agreementPool.releaseAgreement(agreement.id);
    }
  }
}
