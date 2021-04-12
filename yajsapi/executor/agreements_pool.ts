import { NodeInfo } from "../props";
import { Agreement, OfferProposal } from "../rest/market";

class _BufferedProposal {
  ts: Date;
  score: number;
  proposal: OfferProposal;
  constructor(ts: Date, score: number, proposal: OfferProposal) {
    this.ts = ts;
    this.score = score;
    this.proposal = proposal;
  }
}

class BufferedAgreement {
  agreement: Agreement;
  node_info: NodeInfo;
  worker_task?: any;
  has_multi_activity: boolean;
  constructor(agreement: Agreement, node_info: NodeInfo, worker_task?: any, has_multi_activity: boolean) {
    this.agreement = agreement;
    this.node_info = node_info;
    if (worker_task) this.worker_task = worker_task;
    this.has_multi_activity = has_multi_activity;
  }
}

class AgreementsPool {
  _offer_buffer: Map<string, _BufferedProposal> = new Map();
  _agreements: Map<string, BufferedAgreement> = new Map();
  // TODO _lock;
  _rejecting_providers: Set<string> = new Set();
  _confirmed: number = 0;
  async cycle(): Promise<void> {
    for (const agreement_id of this._agreements.keys()) {
      let buffered_agreement = this._agreements[agreement_id];
      if (buffered_agreement === undefined) { continue; }
      let task = buffered_agreement.worker_task;
      /* TODO put JS/TS version of asyncio.Task done() here
      if (task && task.done() {
        await this.release_agreement(buffered_agreement.agreement.id(), !(task.exception))
      }
      */
    }
  }
  async add_proposal(score: number, proposal: OfferProposal): Promise<void> {
    // TODO async with self._lock:
    this._offer_buffer[proposal.issuer()] = new _BufferedProposal(new Date(), score, proposal);
  }
  async use_agreement(cbk: any): Promise<any> {
    // TODO async with self._lock:
    /* TODO check if it's correct */
    let agreement_with_info = await this._get_agreement();
    if (!agreement_with_info) return null;
    let [agreement, node_info] = agreement_with_info;
    let task = cbk(agreement, node_info);
    await this._set_worker(agreement.id(), task);
    return task;
  }
  async _set_worker(agreement_id: string, task: any): Promise<void> {
    let buffered_agreement: BufferedAgreement = this._agreements[agreement_id];
    if (buffered_agreement === undefined) return;
    if (buffered_agreement.worker_task) throw "worker_task must be empty";
    buffered_agreement.worker_task = task;
  }
  private async _get_agreement(): Promise<[Agreement, NodeInfo] | undefined> {
    /* TODO implement */
    return;
  }
  async release_agreement(agreement_id: string, allow_reuse: boolean = true): Promise<void> {
    // TODO async with self._lock:
    /* TODO implement */
  }
  private async _terminate_agreement(agreement_id: string, reason: object): Promise<void> {
    /* TODO implement */
  }
  async terminate_all(reason: object): Promise<void> {
    // TODO async with self._lock:
    /* TODO implement */
  }
  async on_agreement_terminated(agr_id: string, reason: object): Promise<void> {
    // TODO async with self._lock:
    /* TODO implement */
  }
  rejected_last_agreement(provider_id: string): boolean {
    return this._rejecting_providers.has(provider_id);
  }
}
