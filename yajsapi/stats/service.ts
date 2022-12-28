import { Events, EventType, BaseEvent } from "../events";
import { Logger } from "../utils";
import { Providers } from "./providers";
import { Tasks } from "./tasks";
import { Payments } from "./payments";
import { Agreements } from "./agreements";
import { DebitNotes } from "./debit_notes";
import { Invoices } from "./invoices";
import { Proposals } from "./proposals";
import { Allocations } from "./allocations";

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
  private allocations: Allocations;
  private agreements: Agreements;
  //private debitNotes: DebitNotes;
  private invoices: Invoices;
  private proposals: Proposals;
  private providers: Providers;
  private payments: Payments;
  private tasks: Tasks;

  constructor(options: StatsOptions) {
    this.eventTarget = options.eventTarget;
    this.logger = options.logger;
    this.allocations = new Allocations();
    this.agreements = new Agreements();
    //this.debitNotes = new DebitNotes();
    this.invoices = new Invoices();
    this.proposals = new Proposals();
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
    return [];
    // return this.providers.getAllAgreements().map((agreement) => {
    //   const costs = this.payments.getCostsByAgreement(agreement.id);
    //   return {
    //     Agreement: agreement.id.substring(0, 10),
    //     "Provider Name": this.providers.getProviderName(agreement.id) || "unknown",
    //     "Task Computed": this.tasks.getComputedTasksCountAgreementId(agreement.id),
    //     Cost: costs.amount,
    //     "Payment Status": costs.paid ? "paid" : "unpaid",
    //   };
    // });
  }

  getComputationsInfo() {
    // todo
  }

  getTimes() {
    // todo
  }

  private handleEvents(event: BaseEvent<unknown>) {
    if (event instanceof Events.ComputationStarted) {
      //this.tasks.addStartTime(event.timeStamp);
    } else if (event instanceof Events.ComputationFinished) {
      //this.tasks.addStopTime(event.timeStamp);
    } else if (event instanceof Events.TaskStarted) {
      this.tasks.add(event);
    } else if (event instanceof Events.TaskRedone) {
      this.tasks.retry(event);
    } else if (event instanceof Events.TaskRejected) {
      this.tasks.reject(event);
    } else if (event instanceof Events.TaskFinished) {
      this.tasks.finish(event);
    } else if (event instanceof Events.AllocationCreated) {
      this.allocations.add(event);
    } else if (event instanceof Events.AgreementCreated) {
      this.agreements.add(event);
      this.providers.add(event);
    } else if (event instanceof Events.AgreementConfirmed) {
      this.agreements.confirm(event);
    } else if (event instanceof Events.AgreementRejected) {
      this.agreements.reject(event);
    } else if (event instanceof Events.ProposalReceived) {
      this.proposals.add(event);
    } else if (event instanceof Events.InvoiceReceived) {
      this.invoices.add(event);
    } else if (event instanceof Events.PaymentAccepted) {
      this.payments.add(event);
    }
  }
}
