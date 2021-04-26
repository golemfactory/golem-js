import { Activity, NodeInfo } from "../props";
import { Agreement, OfferProposal } from "../rest/market";
import { asyncWith, CancellationToken, Lock, logger } from "../utils";
import * as events from "./events";
import { ComputationHistory } from "./strategy";

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
  worker_task: any;
  has_multi_activity: boolean;
  constructor(agreement: Agreement, node_info: NodeInfo, worker_task: any, has_multi_activity: boolean) {
    this.agreement = agreement;
    this.node_info = node_info;
    if (worker_task) this.worker_task = worker_task;
    this.has_multi_activity = has_multi_activity;
  }
}

export class AgreementsPool implements ComputationHistory {
  private emitter;
  private _cancellation_token: CancellationToken;
  private _offer_buffer: Map<string, _BufferedProposal> = new Map();
  private _agreements: Map<string, BufferedAgreement> = new Map();
  private _lock: Lock = new Lock();
  private _rejecting_providers: Set<string> = new Set();
  private _confirmed: number = 0;
  constructor(emitter, cancellation_token: CancellationToken) {
    this.emitter = emitter;
    this._cancellation_token = cancellation_token;
  }
  async cycle(): Promise<void> {
    for (const agreement_id of new Map(this._agreements).keys()) {
      let buffered_agreement = this._agreements.get(agreement_id);
      if (buffered_agreement === undefined) { continue; }
      let task = buffered_agreement.worker_task;
      if (task && (task.isFulfilled() || task.isRejected())) {
        await this.release_agreement(buffered_agreement.agreement.id(), !task.isRejected());
      }
    }
  }
  async add_proposal(score: number, proposal: OfferProposal): Promise<void> {
    await asyncWith(this._lock, async (lock) => {
      this._offer_buffer.set(proposal.issuer(), new _BufferedProposal(new Date(), score, proposal));
    });
  }
  async use_agreement(cbk: any): Promise<any> {
    let task;
    await asyncWith(this._lock, async (lock) => {
      let agreement_with_info = await this._get_agreement();
      if (!agreement_with_info) return;
      let [agreement, node_info] = agreement_with_info;
      task = cbk(agreement, node_info);
      await this._set_worker(agreement.id(), task);
    });
    return { task };
  }
  async _set_worker(agreement_id: string, task: any): Promise<void> {
    let buffered_agreement = this._agreements.get(agreement_id);
    if (buffered_agreement === undefined) return;
    if (buffered_agreement.worker_task) throw "worker_task must be empty";
    buffered_agreement.worker_task = task;
  }
  private async _get_agreement(): Promise<[Agreement, NodeInfo] | undefined> {
    const emit = this.emitter;
    const available_agreements =
      [...this._agreements.values()].filter(agr => agr.worker_task === undefined);
    if (available_agreements.length > 0) {
      const buffered_agreement
        = available_agreements[Math.floor(Math.random() * available_agreements.length)];
      logger.debug(`Reusing agreement. id: ${buffered_agreement.agreement.id()}`);
      return [buffered_agreement.agreement, buffered_agreement.node_info];
    }

    if (this._offer_buffer.size === 0) { return; }
    let _sample =
      [...this._offer_buffer.entries()]
      .map(x => { return { obj: x, rnd: Math.random() }; })
      .sort((a, b) => a.rnd - b.rnd)
      .map(x => x.obj)
      .reduce((acc, item) => item[1].score > acc[1].score ? item : acc);
    let [provider_id, offer] = _sample;
    this._offer_buffer.delete(provider_id);
    try {
      if (this._cancellation_token.cancelled) return;
      const agreement = await offer.proposal.create_agreement();
      const agreement_details = await agreement.details()
      const provider_activity = <Activity>agreement_details.provider_view().extract(new Activity());
      const requestor_activity = <Activity>agreement_details.requestor_view().extract(new Activity());
      const node_info = <NodeInfo>agreement_details.provider_view().extract(new NodeInfo());
      logger.debug(`New agreement. id: ${agreement.id()}, provider: ${node_info.name}`);
      emit(
        new events.AgreementCreated({
          agr_id: agreement.id(),
          provider_id: provider_id,
          provider_info: node_info,
        })
      );
      if (this._cancellation_token.cancelled) return;
      if (!(await agreement.confirm())) {
        emit(new events.AgreementRejected({ agr_id: agreement.id() }));
        this._rejecting_providers.add(provider_id);
        return;
      }
      this._rejecting_providers.delete(provider_id);
      this._agreements.set(
        agreement.id(),
        new BufferedAgreement(
          agreement,
          node_info,
          undefined,
          provider_activity.multi_activity.value && requestor_activity.multi_activity.value
        )
      )
      emit(new events.AgreementConfirmed({ agr_id: agreement.id() }));
      this._confirmed += 1;
      return [agreement, node_info];
    } catch (e) {
      emit(
        new events.ProposalFailed({
          prop_id: offer.proposal.id(),
          reason: e.toString(),
        })
      );
      throw e;
    }
    return;
  }
  async release_agreement(agreement_id: string, allow_reuse: boolean = true): Promise<void> {
    await asyncWith(this._lock, async (lock) => {
      const buffered_agreement = this._agreements.get(agreement_id);
      if (buffered_agreement === undefined) return;
      buffered_agreement.worker_task = undefined;
      // Check whether agreement can be reused
      if (!allow_reuse || !buffered_agreement.has_multi_activity) {
        const reason = { "message": "Work cancelled", "golem.requestor.code": "Cancelled" };
        await this._terminate_agreement(agreement_id, reason);
      }
    });
  }
  private async _terminate_agreement(agreement_id: string, reason: object): Promise<void> {
    const buffered_agreement = this._agreements.get(agreement_id)
    if (buffered_agreement === undefined) {
      logger.warning(`Trying to terminate agreement not in the pool. id: ${agreement_id}`);
      return;
    }
    if (this._cancellation_token.cancelled) return;
    const agreement_details = await buffered_agreement.agreement.details()
    const provider = <NodeInfo>agreement_details.provider_view().extract(new NodeInfo());
    logger.debug(`Terminating agreement. id: ${agreement_id}, reason: ${JSON.stringify(reason)}, provider: ${provider.name.value}`);
    if (buffered_agreement.worker_task && buffered_agreement.worker_task.isPending()) {
      logger.debug(
        "Terminating agreement that still has worker. " +
        `agreement_id: ${buffered_agreement.agreement.id()}, worker: ${buffered_agreement.worker_task}`
      );
      buffered_agreement.worker_task.cancel();
    }
    if (buffered_agreement.has_multi_activity) {
      if (this._cancellation_token.cancelled) return;
      if (!(await buffered_agreement.agreement.terminate(reason.toString()))) {
        logger.debug(
          `Couldn't terminate agreement. id=${buffered_agreement.agreement.id()}, provider=${provider.name}`
        );
      }
    }
    this._agreements.delete(agreement_id);
    this.emitter(new events.AgreementTerminated({
      agr_id: agreement_id,
      reason: reason.toString(),
    }));
  }
  async terminate_all(reason: object): Promise<void> {
    await asyncWith(this._lock, async (lock) => {
      for (const agreement_id of new Map(this._agreements).keys()) {
        await this._terminate_agreement(agreement_id, reason)
      }
    });
  }
  rejected_last_agreement(provider_id: string): boolean {
    return this._rejecting_providers.has(provider_id);
  }
}
