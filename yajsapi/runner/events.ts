import { any } from "bluebird";
import { Identification } from "../props";
import applyMixins from "../utils/applyMixins";

type ExcInfo = Error;

export class YaEvent {
  constructor() {}

  extract_exc_info(): [ExcInfo | null | undefined, YaEvent] {
    return [null, this];
  }
}

export class ComputationStarted extends YaEvent {}

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
class ProposalEvent extends YaEvent {
  prop_id?: string | null;
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
  constructor({ prop_id = null }) {
    super();
    if (prop_id) this.prop_id = prop_id;
  }
}

export class ProposalConfirmed extends ProposalEvent {
  constructor({ prop_id = null }) {
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
  provider_id?: Identification;
  constructor({ agr_id, provider_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (provider_id) this.provider_id = provider_id;
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
  constructor({ agr_id }) {
    super();
    if (agr_id) this.agr_id = agr_id;
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

export class CheckingPayments extends AgreementEvent {
}

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

export class WorkerFinished extends AgreementEvent {
  exception?: ExcInfo | null = null;

  constructor({ agr_id, exception }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (exception) this.exception = exception;
  }

  extract_exc_info(): [ExcInfo | null | undefined, YaEvent] {
    const exc_info = this.exception;
    const me = Object.assign(
      new WorkerFinished({ agr_id: undefined, exception: undefined }),
      this
    );
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

export class CommandExecuted extends ScriptEvent {
  success?: boolean;
  cmd_idx?: number;
  command?: any;
  message?: string;

  constructor({ agr_id, task_id, success, cmd_idx, command, message }) {
    super();
    if (agr_id) this.agr_id = agr_id;
    if (task_id) this.task_id = task_id;
    if (success) this.success = success;
    if (cmd_idx) this.cmd_idx = cmd_idx;
    if (command) this.command = command;
    if (message) this.message = message;
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
