/* eslint no-prototype-builtins: 0 */
import { NodeInfo } from "../props";
import applyMixins from "../utils/applyMixins";
import { ExeScriptCommandResultResultEnum } from "ya-ts-client/dist/ya-activity/src/models";
import { Result } from "../activity";

type ExcInfo = Error;

/**
 * An abstract base class for types of events emitted by `Executor.submit()`.
 */
export class YaEvent {
  /**
   * Extract exception information from this event.
   *
   * @returns The extracted exception information and a copy of the event without the exception information.
   */
  extract_exc_info(): [ExcInfo | null | undefined, YaEvent] {
    return [null, this];
  }
}

export class ComputationStarted extends YaEvent {
  expires?: number;
  constructor({ expires }) {
    super();
    this.expires = expires;
  }
}

// Indicates successful completion if `exc_info` is `None` and a failure otherwise.
export class ComputationFinished extends YaEvent {}

export class ComputationFailed extends YaEvent {
  reason?: string;
}

export class PaymentsFinished extends YaEvent {}

export class SubscriptionCreated extends YaEvent {
  sub_id?: string;
  constructor({ sub_id }) {
    super();
    if (sub_id) this.sub_id = sub_id;
  }
}

export class SubscriptionFailed extends YaEvent {
  reason?: string;
  constructor({ reason }) {
    super();
    if (reason) this.reason = reason;
  }
}

export class CollectFailed extends YaEvent {
  sub_id!: string;
  reason!: string;
  constructor({ sub_id, reason }) {
    super();
    if (sub_id) this.sub_id = sub_id;
    if (reason) this.reason = reason;
  }
}

// @dataclass(init=False)
export class ProposalEvent extends YaEvent {
  prop_id?: string;
}

export class ProposalReceived extends ProposalEvent {
  provider_id?: string;
  constructor({ prop_id, provider_id }) {
    super();
    if (prop_id) this.prop_id = prop_id;
    if (provider_id) this.provider_id = provider_id;
  }
}

export class ProposalRejected extends ProposalEvent {
  reason?: string;
  constructor({ prop_id, reason = "" }) {
    super();
    if (prop_id) this.prop_id = prop_id;
    if (reason) this.reason = reason;
  }
}

export class ProposalResponded extends ProposalEvent {
  constructor({ prop_id }) {
    super();
    if (prop_id) this.prop_id = prop_id;
  }
}

export class ProposalConfirmed extends ProposalEvent {
  constructor({ prop_id }) {
    super();
    if (prop_id) this.prop_id = prop_id;
  }
}

export class ProposalFailed extends ProposalEvent {
  reason?: string | null;
  constructor({ prop_id, reason }) {
    super();
    if (prop_id) this.prop_id = prop_id;
    if (reason) this.reason = reason;
  }
}

export class NoProposalsConfirmed extends YaEvent {
  num_offers?: number;
  timeout?: number; //timedelta

  constructor({ num_offers, timeout }) {
    super();
    this.num_offers = num_offers;
    this.timeout = timeout;
  }
}

class AgreementEvent extends YaEvent {
  agr_id?: string;
}

export class AgreementCreated extends AgreementEvent {
  provider_id?: string;
  provider_info?: NodeInfo;
  constructor({ agr_id, provider_id, provider_info }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    this.provider_id = provider_id;
    if (provider_info) this.provider_info = provider_info;
  }
}

export class AgreementConfirmed extends AgreementEvent {
  constructor({ agr_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
  }
}

export class AgreementRejected extends AgreementEvent {
  constructor({ agr_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
  }
}

export class AgreementTerminated extends AgreementEvent {
  reason?: string | null;
  constructor({ agr_id, reason }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (reason) this.reason = reason;
  }
}

export class DebitNoteReceived extends AgreementEvent {
  note_id!: string;
  amount!: string;
  constructor({ agr_id, note_id, amount }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    this.note_id = note_id;
    this.amount = amount;
  }
}

export class PaymentAccepted extends AgreementEvent {
  inv_id!: string;
  amount!: string;
  constructor({ agr_id, inv_id, amount }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (inv_id) this.inv_id = inv_id;
    if (amount) this.amount = amount;
  }
}

export class PaymentFailed extends AgreementEvent {
  // TODO add exc_info
  reason!: string;
  constructor({ agr_id, reason }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    this.reason = reason;
  }
}

export class PaymentPrepared extends AgreementEvent {
  constructor({ agr_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
  }
}

export class PaymentQueued extends AgreementEvent {
  constructor({ agr_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
  }
}

export class CheckingPayments extends AgreementEvent {}

export class InvoiceReceived extends AgreementEvent {
  inv_id?: string;
  amount?: string;
  constructor({ agr_id, inv_id, amount }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (inv_id) this.inv_id = inv_id;
    if (amount) this.amount = amount;
  }
}

export class WorkerStarted extends AgreementEvent {
  constructor({ agr_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
  }
}

export class ActivityCreated extends AgreementEvent {
  act_id?: string;
  constructor({ agr_id, act_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (act_id) this.act_id = act_id;
  }
}

export class ActivityCreateFailed extends AgreementEvent {
  constructor({ agr_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
  }
}

class TaskEvent extends YaEvent {
  task_id?: string;
}

interface EventGeneral extends AgreementEvent, TaskEvent {}
class EventGeneral {}

applyMixins(EventGeneral, [AgreementEvent, TaskEvent]);

export class TaskStarted extends EventGeneral {
  task_data?: any;
  constructor({ agr_id, task_id, task_data }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (task_id) this.task_id = task_id;
    this.task_data = task_data;
  }
}

// Indicates successful completion if `exc_info` is `None` and a failure otherwise.
export class WorkerFinished extends AgreementEvent {
  exception?: ExcInfo | null = null;

  constructor({ agr_id, exception }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (exception) this.exception = exception;
  }

  extract_exc_info(): [ExcInfo | null | undefined, YaEvent] {
    const exc_info = this.exception;
    const me = Object.assign(new WorkerFinished({ agr_id: undefined, exception: undefined }), this);
    me.exception = null;
    return [exc_info, me];
  }
}

class ScriptEvent extends AgreementEvent {
  task_id?: string | null;
}

export class ScriptSent extends ScriptEvent {
  cmds?: any;
  constructor({ agr_id, task_id, cmds }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (task_id) this.task_id = task_id;
    if (cmds) this.cmds = cmds;
  }
}

export class GettingResults extends ScriptEvent {
  constructor({ agr_id, task_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (task_id) this.task_id = task_id;
  }
}

export class ScriptFinished extends ScriptEvent {
  constructor({ agr_id, task_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (task_id) this.task_id = task_id;
  }
}

export class CommandEvent extends ScriptEvent {
  cmd_idx: number;
  constructor({ agr_id, task_id, cmd_idx }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    this.task_id = task_id;
    this.cmd_idx = cmd_idx;
  }
}

export class CommandExecuted extends CommandEvent {
  command?: any;
  success?: boolean;
  message?: string;
  stdout?: string;
  stderr?: string;

  constructor({ agr_id, task_id, success, cmd_idx, command, message, stdout, stderr }) {
    super({ agr_id, cmd_idx, task_id });
    if (success) this.success = success;
    if (command) this.command = command;
    if (message) this.message = message;
    if (stdout) this.stdout = stdout;
    if (stderr) this.stderr = stderr;
  }

  static fromActivityResult(result: Result): CommandEventContext {
    const evt = Object.create(CommandExecuted.prototype);
    evt.cmd_idx = evt.idx = result.index;
    evt.stdout = result.stdout;
    evt.stderr = result.stderr;
    evt.message = result.message;
    evt.command = "";
    evt.success = result.result === ExeScriptCommandResultResultEnum.Ok;
    return new CommandEventContext(evt);
  }
}

export class CommandEventContext {
  evt: CommandEvent;
  constructor(evt_cls) {
    this.evt = evt_cls;
  }

  static fromJson(json: string): CommandEventContext {
    let rt_evt: RuntimeEvent;
    try {
      rt_evt = JSON.parse(json);
    } catch (_e) {
      throw new Error(`cannot parse ${json} as RuntimeEvent`);
    }
    let out_evt: CommandEvent;

    if (rt_evt.kind.started) {
      const evt = Object.create(CommandStarted.prototype);
      evt.cmd_idx = rt_evt.index;
      evt.command = rt_evt.kind.started.command;
      out_evt = evt;
    } else if (rt_evt.kind.stdout) {
      const evt = Object.create(CommandStdOut.prototype);
      evt.cmd_idx = rt_evt.index;
      evt.output = rt_evt.kind.stdout ? rt_evt.kind.stdout.toString().trimEnd() : "";
      out_evt = evt;
    } else if (rt_evt.kind.stderr) {
      const evt = Object.create(CommandStdErr.prototype);
      evt.cmd_idx = rt_evt.index;
      evt.output = rt_evt.kind.stderr ? rt_evt.kind.stderr.toString().trimEnd() : "";
      out_evt = evt;
    } else if (rt_evt.kind.finished) {
      const evt = Object.create(CommandExecuted.prototype);
      evt.cmd_idx = rt_evt.index;
      evt.command = rt_evt.kind.finished.command;
      evt.success = rt_evt.kind.finished.return_code == 0;
      out_evt = evt;
    } else {
      throw new Error(`invalid event: ${json}`);
    }

    return new CommandEventContext(out_evt);
  }

  computation_finished(last_idx): boolean {
    const cmd_idx = this.evt.cmd_idx;
    const success = this.evt.hasOwnProperty("success") ? this.evt["success"] : undefined;
    return cmd_idx !== undefined && (cmd_idx >= last_idx || success === false);
  }

  event(agr_id: string, task_id: string, cmds: any[]): CommandEvent {
    this.evt.agr_id = agr_id;
    this.evt.task_id = task_id;

    if (this.evt.hasOwnProperty("command")) {
      const idx: number = this.evt.cmd_idx;
      this.evt["command"] = cmds[idx];
    }
    return this.evt;
  }
}

interface RuntimeEvent {
  batch_id: string;
  index: number;
  timestamp: string;
  kind: RuntimeEventKind;
}

interface RuntimeEventKind {
  started?: RuntimeEventStarted;
  stdout?: RuntimeEventStdOut;
  stderr?: RuntimeEventStdErr;
  finished?: RuntimeEventFinished;
}

interface RuntimeEventStarted {
  command: object;
}

interface RuntimeEventStdOut {
  output: string | ArrayBuffer;
}

interface RuntimeEventStdErr {
  output: string | ArrayBuffer;
}

interface RuntimeEventFinished {
  command: object;
  return_code: number;
}

export class CommandStarted extends CommandEvent {
  command!: string;
}

export class CommandStdOut extends CommandEvent {
  output!: string;
}

export class CommandStdErr extends CommandEvent {
  output: string;

  constructor({ agr_id, task_id, cmd_idx, output }) {
    super({ agr_id, task_id, cmd_idx });
    this.output = output;
  }
}

export class TaskAccepted extends TaskEvent {
  result?: any;
  constructor({ task_id, result }) {
    super();
    if (task_id) this.task_id = task_id;
    if (result) this.result = result;
  }
}

export class TaskRejected extends TaskEvent {
  reason?: string | null;
  constructor({ task_id, reason }) {
    super();
    if (task_id) this.task_id = task_id;
    if (reason) this.reason = reason;
  }
}

export class DownloadStarted extends YaEvent {
  path?: string;

  constructor({ path }) {
    super();
    if (path) this.path = path;
  }
}

export class DownloadFinished extends YaEvent {
  path?: string;

  constructor({ path }) {
    super();
    if (path) this.path = path;
  }
}

export class ShutdownFinished {
  // TBD
}
