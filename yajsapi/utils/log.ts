import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import path from "path";
import winston from "winston";
import { Callable } from "./";
import * as events from "../executor/events";

const REPORT_CONFIRMED_PROVIDERS_INTERVAL: number = 3000;

dayjs.extend(duration);

const event_type_to_string = {
  [events.ComputationStarted.name]: "Computation started",
  [events.ComputationFinished.name]: "Computation finished",
  [events.ComputationFailed.name]: "Computation failed",
  [events.SubscriptionCreated.name]: "Demand published on the market",
  [events.SubscriptionFailed.name]: "Demand publication failed",
  [events.CollectFailed.name]: "Failed to collect proposals for demand",
  [events.NoProposalsConfirmed.name]: "No proposals confirmed by providers",
  [events.ProposalReceived.name]: "Proposal received from the market",
  [events.ProposalRejected.name]: "Proposal rejected",
  [events.ProposalResponded.name]: "Responded to a proposal",
  [events.ProposalFailed.name]: "Failed to respond to proposal",
  [events.ProposalConfirmed.name]: "Proposal confirmed by provider",
  [events.AgreementCreated.name]: "Agreement proposal sent to provider",
  [events.AgreementConfirmed.name]: "Agreement approved by provider",
  [events.AgreementRejected.name]: "Agreement rejected by provider",
  [events.DebitNoteReceived.name]: "Debit note received",
  [events.PaymentAccepted.name]: "Payment accepted",
  [events.PaymentPrepared.name]: "Payment prepared",
  [events.PaymentFailed.name]: "Payment failed",
  [events.PaymentQueued.name]: "Payment queued",
  [events.PaymentsFinished.name]: "Finished waiting for payments",
  [events.CheckingPayments.name]: "Checking payments",
  [events.InvoiceReceived.name]: "Invoice received",
  [events.WorkerStarted.name]: "Worker started for agreement",
  [events.ActivityCreated.name]: "Activity created on provider",
  [events.ActivityCreateFailed.name]: "Failed to create activity",
  [events.TaskStarted.name]: "Task started",
  [events.ScriptSent.name]: "Script sent to provider",
  [events.CommandExecuted.name]: "Script command executed",
  [events.GettingResults.name]: "Getting script results",
  [events.ScriptFinished.name]: "Script finished",
  [events.TaskAccepted.name]: "Task accepted",
  [events.TaskRejected.name]: "Task rejected",
  [events.WorkerFinished.name]: "Worker finished",
  [events.DownloadStarted.name]: "Download started",
  [events.DownloadFinished.name]: "Download finished",
};

const { colorize, combine, timestamp, label, printf } = winston.format;
const customFormat = printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${message}`;
});

let options = {
  level: "info",
  format: combine(
    colorize(),
    label({ label: "yajsapi" }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSSZ" }),
    customFormat
  ),
  defaultMeta: { service: "user-service" },
  transports: [
    new winston.transports.Console(),
  ],
};
const logColors = {
  info: "blue",
  debug: "magenta",
  warn: "yellow",
  error: "red",
};
winston.addColors(logColors);
const logger = winston.createLogger(options);

class ProviderInfo {
  public id: string;
  public name: string;
  public subnet_tag: string | null;
  constructor(id: string, name: string, subnet_tag: string | null) {
    this.id = id;
    this.name = name;
    this.subnet_tag = subnet_tag;
  }
}

class SummaryLogger {
  private _wrapped_emitter: Callable<[events.YaEvent], void> | null;

  // Start time of the computation
  start_time!: number;

  // Maps received proposal ids to provider ids
  received_proposals!: { [key: string]: string };

  // Set of confirmed proposal ids
  confirmed_proposals!: Set<string>;

  // Last number of confirmed providers
  prev_confirmed_providers!: number;

  // Maps agreement ids to provider infos
  agreement_provider_info!: { [key: string]: ProviderInfo };

  // Set of agreements confirmed by providers
  confirmed_agreements!: Set<string>;

  // Maps task id to task data
  task_data!: { [key: string]: any };

  // Maps a provider info to the list of task ids computed by the provider
  provider_tasks!: Map<ProviderInfo, string[]>;

  // Map a provider info to the sum of amounts in this provider's invoices
  provider_cost!: Map<ProviderInfo, number>;

  // Count how many times a worker failed on a provider
  provider_failures!: Map<ProviderInfo, number>;

  // Has computation finished?
  finished!: boolean;

  // Has Executor shut down?
  shutdown_complete: boolean = false;

  error_occurred!: boolean;

  time_waiting_for_proposals;

  constructor(wrapped_emitter: Callable<[events.YaEvent], void> | null = null) {
    this._wrapped_emitter = wrapped_emitter;
    this._reset();
    this._print_confirmed_providers();
  }

  _reset(): void {
    this.start_time = dayjs().valueOf() / 1000;
    this.received_proposals = {};
    this.confirmed_proposals = new Set();
    this.agreement_provider_info = {};
    this.confirmed_agreements = new Set();
    this.task_data = {};
    this.provider_tasks = new Map<ProviderInfo, string[]>();
    this.provider_cost = new Map<ProviderInfo, number>();
    this.provider_failures = new Map<ProviderInfo, number>();
    this.finished = false;
    this.error_occurred = false;
    this.time_waiting_for_proposals = dayjs.duration(0);
    this.prev_confirmed_providers = 0;
  }

  _print_cost(): void {
    const results = [...this.confirmed_agreements].map((agr_id) => {
      const info = this.agreement_provider_info[agr_id];
      const tasks = this.provider_tasks.get(info);
      const cost = this.provider_cost.get(info) || "0 (no invoices?)";
      return {
        Agreement: agr_id.toString().substring(0, 10),
        "Provider Name": info.name,
        "Tasks Computed": tasks ? tasks.length : 0,
        Cost: cost,
      };
    });
    if (results.length > 0) { console.table(results); }
  }

  _print_confirmed_providers(): void {
    const confirmed_providers = new Set(
      [...this.confirmed_proposals].map(
        (prop_id) => this.received_proposals[prop_id]
      )
    );
    if (this.prev_confirmed_providers < confirmed_providers.size) {
      logger.info(`Received proposals from ${confirmed_providers.size} providers so far`);
      this.prev_confirmed_providers = confirmed_providers.size;
    }
    if (!this.shutdown_complete) {
      setTimeout(() => this._print_confirmed_providers(), REPORT_CONFIRMED_PROVIDERS_INTERVAL);
    }
  }

  log(event: events.YaEvent): void {
    // """Register an event."""

    if (this._wrapped_emitter) this._wrapped_emitter(event);
    if (this.error_occurred) return;

    try {
      this._handle(event);
    } catch (error) {
      logger.error(`SummaryLogger entered invalid state ${error}`);
      this.error_occurred = true;
    }
  }

  _handle(event: events.YaEvent) {
    const eventName = event.constructor.name;
    if (eventName === events.ComputationStarted.name) this._reset();
    if (eventName === events.SubscriptionCreated.name)
      logger.info(event_type_to_string[eventName]);
    else if (eventName === events.SubscriptionFailed.name)
      logger.error(`Subscription failed: ${event["reason"]}`);
    else if (eventName === events.ProposalReceived.name)
      this.received_proposals[event["prop_id"]] = event["provider_id"];
    else if (eventName === events.ProposalConfirmed.name) {
      this.confirmed_proposals.add(event["prop_id"]);
    } else if (eventName === events.NoProposalsConfirmed.name) {
      this.time_waiting_for_proposals = this.time_waiting_for_proposals.add({
        millisecond: parseInt(event["timeout"]),
      });
      let msg;
      if (event["num_offers"] === 0)
        msg = `No offers have been collected from the market for
            ${this.time_waiting_for_proposals.asSeconds()}s. `;
      else
        msg = `${
          event["num_offers"]
        } offers have been collected from the market, but no provider has responded for ${this.time_waiting_for_proposals.asSeconds()}s. `;
      msg +=
        "Make sure you're using the latest released versions of yagna and yajsapi, and the correct subnet.";
      logger.warn(msg);
    } else if (eventName === events.AgreementCreated.name) {
      let provider_name =
        event["provider_info"].name.value || event["provider_id"];
      logger.info(`Agreement proposed to provider '${provider_name}'`);
      this.agreement_provider_info[event["agr_id"]] = new ProviderInfo(
        event["provider_id"],
        provider_name,
        event["provider_info"].subnet_tag
      );
    } else if (eventName === events.AgreementConfirmed.name) {
      logger.info(
        `Agreement confirmed by provider '${
          this.agreement_provider_info[event["agr_id"]].name
        }'`
      );
      this.confirmed_agreements.add(event["agr_id"]);
    } else if (eventName === events.TaskStarted.name) {
      this.task_data[event["task_id"]] = event["task_data"];
      logger.debug(`Task started for agreement ${event["agr_id"]}`);
    } else if (eventName === events.TaskAccepted.name) {
      logger.debug(`Task accepted, task_id=${event["task_id"]}`);
    } else if (eventName === events.ScriptSent.name) {
      const provider_info = this.agreement_provider_info[event["agr_id"]];
      logger.info(
        `Task sent to provider '${provider_info.name}', task data: ${
          event["task_id"]
            ? this.task_data[event["task_id"]]
            : "<initialization>"
        }`
      );
    } else if (eventName === events.CommandExecuted.name) {
      const provider_name = this.agreement_provider_info[event["agr_id"]].name;
      const cmd = JSON.stringify(event["command"]);
      if (event["success"]) {
        logger.debug(`Command successful on provider '${provider_name}', command: ${cmd}.`);
        logger.silly(`Command ${cmd}: stdout: ${event["stdout"]}, stderr: ${event["stderr"]}, msg: ${event["message"]}.`);
      } else {
        logger.warn(`Command failed on provider '${provider_name}', command: ${cmd}, msg: ${event["message"]}`);
        logger.debug(`Command ${cmd}: stdout: ${event["stdout"]}, stderr: ${event["stderr"]}.`);
      }
    } else if (eventName === events.ScriptFinished.name) {
      const provider_info = this.agreement_provider_info[event["agr_id"]];
      logger.info(
        `Task computed by provider '${provider_info.name}', task data: ${
          event["task_id"]
            ? this.task_data[event["task_id"]]
            : "<initialization>"
        }`
      );
      if (event["task_id"]) {
        let ids = this.provider_tasks.get(provider_info);
        if (!ids) this.provider_tasks.set(provider_info, [event["task_id"]]);
        else {
          ids.push(event["task_id"]);
          this.provider_tasks.set(provider_info, ids);
        }
      }
    } else if (eventName === events.InvoiceReceived.name) {
      const provider_info = this.agreement_provider_info[event["agr_id"]];
      let cost = this.provider_cost.get(provider_info) || 0;
      cost += parseFloat(event["amount"]);
      this.provider_cost.set(provider_info, cost);
      logger.debug(
        `Received an invoice from ${provider_info.name}. Amount: ${event["amount"]}; (so far: ${cost} from this provider).`
      );
    } else if (eventName === events.CheckingPayments.name) {
      if (options.level == "debug") {
        this._print_cost();
      }
    } else if (eventName === events.WorkerFinished.name) {
      if (event["exception"] === null || event["exception"] === undefined) return;
      const provider_info = this.agreement_provider_info[event["agr_id"]];
      let failures = this.provider_failures.get(provider_info);
      if (failures === undefined) this.provider_failures.set(provider_info, 1);
      else this.provider_failures.set(provider_info, failures + 1);
      let more_info = "";
      if (
        event["exception"] &&
        event["exception"].response &&
        event["exception"].response.data
      ) {
        more_info = `, info: ${event["exception"].response.data.message}`;
      }
      logger.warn(
        `Activity failed on provider '${provider_info.name}', reason: ${event["exception"]}${more_info}`
      );
    } else if (eventName === events.ComputationFinished.name) {
      this.finished = true;
      const total_time = dayjs().valueOf() / 1000 - this.start_time;
      logger.info(`Computation finished in ${total_time.toFixed(1)}s`);
      const num_providers = [...this.confirmed_agreements].map(
        (agr_id) => this.agreement_provider_info[agr_id]
      ).length;
      logger.info(
        `Negotiated ${this.confirmed_agreements.size} agreements with ${num_providers} providers`
      );
      for (let [info, tasks] of this.provider_tasks.entries()) {
        logger.info(`Provider '${info.name}' computed ${tasks.length} tasks`);
      }
      for (let info of new Set(Object.values(this.agreement_provider_info))) {
        if (!this.provider_tasks.has(info))
          logger.info(`Provider '${info.name}' did not compute any tasks`);
      }
      for (let [info, num] of this.provider_failures.entries())
        logger.info(
          `Activity failed ${num} time(s) on provider '${info.name}'`
        );
    } else if (eventName === events.PaymentsFinished.name) {
      logger.info(`Finished waiting for payments. Summary:`);
      this._print_cost();
      const total_cost = [...this.provider_cost.values()].reduce(
        (acc, item) => acc + item,
        0
      );
      logger.info(`Total Cost: ${total_cost}`);
    } else if (eventName === events.ComputationFailed.name) {
      logger.error(`Computation failed, reason: ${event["reason"]}`);
    } else if (eventName === events.PaymentAccepted.name) {
      const provider_info = this.agreement_provider_info[event["agr_id"]];
      logger.info(`Accepted invoice from '${provider_info.name}'`);
    } else if (eventName === events.PaymentFailed.name) {
      const provider_name = this.agreement_provider_info[event["agr_id"]].name;
      logger.error(
        `Payment for provider ${provider_name} failed; reason: ${event["reason"]}.`
      );
    } else if (eventName === events.PaymentPrepared.name) {
      logger.debug(
        `Prepared payment for agreement ${event["agr_id"].substr(0, 17)}`
      );
    } else if (eventName === events.PaymentQueued.name) {
      logger.debug(
        `Queued payment for agreement ${event["agr_id"].substr(0, 17)}`
      );
    } else if (eventName === events.ShutdownFinished.name) {
      this.shutdown_complete = true;
    }
  }
}

export function logSummary(
  wrapped_emitter?: Callable<[events.YaEvent], void> | null | undefined
) {
  const summary_logger = new SummaryLogger(wrapped_emitter);
  return summary_logger.log.bind(summary_logger);
}

export const changeLogLevel = (level: string) => {
  options.level = level;
  options.transports = [
    new winston.transports.Console({ level: level }),
    new winston.transports.File({
      filename: path.join(
        "logs",
        `yajsapi-${dayjs().format("YYYY-MM-DD_HH-mm-ss")}.log`
      ),
      level: "silly",
    }) as any,
    new winston.transports.File({
      filename: path.join("logs", "yajsapi-current.log"),
      level: "silly",
      options: { flags: "w" },
    }) as any
  ];
  logger.configure(options);
};

export default logger;
