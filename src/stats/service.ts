import { Events, EVENT_TYPE, BaseEvent } from "../events";
import { Logger } from "../utils";
import { Providers } from "./providers";
import { Tasks } from "./tasks";
import { Payments } from "./payments";
import { Agreements } from "./agreements";
import { Invoices } from "./invoices";
import { Proposals } from "./proposals";
import { Allocations } from "./allocations";
import { Activities } from "./activities";
import { Times } from "./times";

interface StatsOptions {
  eventTarget: EventTarget;
  logger?: Logger;
}

/**
 * @internal
 */
export class StatsService {
  private eventTarget: EventTarget;
  private logger?: Logger;
  private allocations: Allocations;
  private agreements: Agreements;
  private activities: Activities;
  private invoices: Invoices;
  private proposals: Proposals;
  private providers: Providers;
  private payments: Payments;
  private tasks: Tasks;
  private times: Times;

  constructor(options: StatsOptions) {
    this.eventTarget = options.eventTarget;
    this.logger = options.logger;
    this.allocations = new Allocations();
    this.activities = new Activities();
    this.agreements = new Agreements();
    this.invoices = new Invoices();
    this.proposals = new Proposals();
    this.providers = new Providers();
    this.payments = new Payments();
    this.tasks = new Tasks();
    this.times = new Times();
  }

  async run() {
    this.eventTarget.addEventListener(EVENT_TYPE, (event) => this.handleEvents(event as BaseEvent<unknown>));
    this.logger?.debug("Stats service has started");
  }

  async end() {
    this.eventTarget.removeEventListener(EVENT_TYPE, null);
    this.logger?.debug("Stats service has stopped");
  }

  getAllCostsSummary() {
    return this.agreements
      .getAll()
      .map((agreement) => {
        const provider = this.providers.getById(agreement.provider.id);
        const tasks = this.tasks.getByAgreementId(agreement.id);
        const invoices = this.invoices.getByAgreementId(agreement.id);
        const payments = this.payments.getByAgreementId(agreement.id);
        return {
          Agreement: agreement.id.substring(0, 10),
          "Provider Name": provider ? provider.name : "unknown",
          "Task Computed": tasks.where("status", "finished").count(),
          Cost: invoices.sum("amount"),
          "Payment Status": payments.count() > 0 ? "paid" : "unpaid",
        };
      })
      .all();
  }

  getAllCosts() {
    const costs = { total: 0, paid: 0 };
    this.agreements
      .getAll()
      .all()
      .forEach((agreement) => {
        const invoices = this.invoices.getByAgreementId(agreement.id);
        const payments = this.payments.getByAgreementId(agreement.id);
        costs.total += invoices.sum("amount") as number;
        costs.paid += payments.count() > 0 ? (invoices.sum("amount") as number) : 0;
      });
    return costs;
  }

  getComputationTime(): string {
    const duration = this.times.getById("all")?.duration;
    return `${duration ? (duration / 1000).toFixed(1) : 0}s`;
  }

  getStatsTree() {
    return {
      allocations: this.allocations
        .getAll()
        .map((allocation) => allocation)
        .all(),
      providers: this.providers
        .getAll()
        .map((provider) => {
          return {
            ...provider,
            proposals: this.proposals
              .getByProviderId(provider.id)
              .map((proposal) => {
                const agreement = this.agreements.getByProposalId(proposal.id);
                return {
                  ...proposal,
                  agreement: agreement
                    ? {
                        ...agreement,
                        activities: this.activities
                          .getByAgreementId(agreement.id)
                          .map((activity) => {
                            return {
                              ...activity,
                              task: this.tasks.getById(activity.taskId),
                            };
                          })
                          .all(),
                        invoices: this.invoices
                          .getByAgreementId(agreement.id)
                          .map((invoice) => invoice)
                          .all(),
                        payments: this.payments
                          .getByAgreementId(agreement.id)
                          .map((payment) => payment)
                          .all(),
                      }
                    : null,
                };
              })
              .all(),
          };
        })
        .all(),
      agreements: this.agreements
        .getAll()
        .map((agreement) => {
          const provider = this.providers.getById(agreement.provider.id);
          const tasks = this.tasks.getByAgreementId(agreement.id);
          const invoices = this.invoices.getByAgreementId(agreement.id);
          const payments = this.payments.getByAgreementId(agreement.id);
          return {
            agreementId: agreement.id,
            provider,
            tasks: tasks.where("status", "finished").count(),
            cost: invoices.sum("amount"),
            paymentStatus: payments.count() > 0 ? "paid" : "unpaid",
          };
        })
        .all(),
      costs: this.getAllCosts(),
    };
  }

  private handleEvents(event: BaseEvent<unknown>) {
    if (event instanceof Events.ComputationStarted) {
      this.times.add({ id: "all", startTime: event.timeStamp });
    } else if (event instanceof Events.ComputationFinished) {
      this.times.stop({ id: "all", stopTime: event.timeStamp });
    } else if (event instanceof Events.TaskStarted) {
      this.activities.add({
        id: event.detail.activityId,
        taskId: event.detail.id,
        agreementId: event.detail.agreementId,
      });
      this.tasks.add({
        id: event.detail.id,
        startTime: event.timeStamp,
        agreementId: event.detail.agreementId,
      });
    } else if (event instanceof Events.TaskRedone) {
      this.tasks.retry(event.detail.id, event.detail.retriesCount);
    } else if (event instanceof Events.TaskRejected) {
      this.tasks.reject(event.detail.id, event.timeStamp, event.detail.reason);
    } else if (event instanceof Events.TaskFinished) {
      this.tasks.finish(event.detail.id, event.timeStamp);
    } else if (event instanceof Events.AllocationCreated) {
      this.allocations.add({ id: event.detail.id, amount: event.detail.amount, platform: event.detail.platform });
    } else if (event instanceof Events.AgreementCreated) {
      this.agreements.add({
        id: event.detail.id,
        provider: event.detail.provider,
        proposalId: event.detail.proposalId,
      });
      this.providers.add(event.detail.provider);
    } else if (event instanceof Events.AgreementConfirmed) {
      this.agreements.confirm(event.detail.id);
    } else if (event instanceof Events.AgreementRejected) {
      this.agreements.reject(event.detail.id);
    } else if (event instanceof Events.ProposalReceived) {
      this.proposals.add({ id: event.detail.id, providerId: event.detail.provider.id });
      this.providers.add({ ...event.detail.provider });
    } else if (event instanceof Events.InvoiceReceived) {
      this.invoices.add({
        id: event.detail.id,
        provider: event.detail.provider,
        agreementId: event.detail.agreementId,
        amount: event.detail.amount,
      });
    } else if (event instanceof Events.PaymentAccepted) {
      this.payments.add({
        id: event.detail.id,
        agreementId: event.detail.agreementId,
        amount: event.detail.amount,
        provider: event.detail.provider,
      });
    }
  }
}
