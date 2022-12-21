import { Events, EventType, BaseEvent } from "../events";
import { Logger } from "../utils";
import { Providers } from "./providers";
import { Tasks } from "./tasks";
import { Payments } from "./payments";

interface StatsOptions {
  eventTarget: EventTarget;
  logger?: Logger;
}

interface CostsInfo {
  Agreement: string;
  "Provider Name": string;
  "Task Computed": number;
  Cost: number;
  "Payment Status": "paid" | "unpaid";
}

export class StatsService {
  private eventTarget: EventTarget;
  private logger?: Logger;
  private providers: Providers;
  private payments: Payments;
  private tasks: Tasks;

  constructor(options: StatsOptions) {
    this.eventTarget = options.eventTarget;
    this.logger = options.logger;
    this.providers = new Providers();
    this.payments = new Payments();
    this.tasks = new Tasks();
  }

  async run() {
    this.eventTarget.addEventListener(EventType, (event) => this.handleEvents(event as BaseEvent<unknown>));
    this.logger?.debug("Stats service has started");
  }

  async end() {
    this.eventTarget.removeEventListener(EventType, null);
    this.logger?.debug("Stats service has stopped");
  }

  getProviderInfo(providerId: string) {
    // todo
  }

  getTaskInfo(taskId: string) {
    // todo
  }

  getAllCosts(): CostsInfo[] {
    return this.providers.getAllAgreements().map((agreement) => {
      const costs = this.payments.getCostsByAgreement(agreement.id);
      return {
        Agreement: agreement.id.substring(0, 10),
        "Provider Name": this.providers.getProviderName(agreement.id) || "unknown",
        "Task Computed": this.tasks.getComputedTasks(agreement.id),
        Cost: costs.amount,
        "Payment Status": costs.paid ? "paid" : "unpaid",
      };
    });
  }

  getComputationsInfo() {
    // todo
  }

  getTimes() {
    // todo
  }

  private handleEvents(event: BaseEvent<unknown>) {
    if (event instanceof Events.ComputationStarted) {
      this.tasks.addStartTime(event.timeStamp);
    } else if (event instanceof Events.ComputationFinished) {
      this.tasks.addStopTime(event.timeStamp);
    } else if (event instanceof Events.TaskStarted) {
      this.tasks.startTask(event.detail.id, event.detail.agreementId, event.detail.activityId, event.timeStamp);
    } else if (event instanceof Events.TaskRedone) {
      this.tasks.retryTask(event.detail.id, event.detail.retriesCount);
    } else if (event instanceof Events.TaskRejected) {
      this.tasks.stopTask(event.detail.id, event.timeStamp, false, event.detail.reason);
    } else if (event instanceof Events.TaskFinished) {
      this.tasks.stopTask(event.detail.id, event.timeStamp, true);
    } else if (event instanceof Events.AllocationCreated) {
      this.payments.addAllocation(event.detail);
    } else if (event instanceof Events.AgreementCreated) {
      this.providers.addAgreement(event.detail.id, event.detail.providerId, event.detail.providerName);
    } else if (event instanceof Events.AgreementConfirmed) {
      this.providers.confirmAgreement(event.detail.id);
    } else if (event instanceof Events.ProposalReceived) {
      this.payments.addProposal(event.detail.id, event.detail.providerId);
    } else if (event instanceof Events.InvoiceReceived) {
      this.payments.addInvoice(event.detail.id, event.detail.providerId, event.detail.agreementId, event.detail.amount);
    } else if (event instanceof Events.PaymentAccepted) {
      this.payments.addPayment(event.detail.id, event.detail.providerId, event.detail.agreementId, event.detail.amount);
    }
  }
}
