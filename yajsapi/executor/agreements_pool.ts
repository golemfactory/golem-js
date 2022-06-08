/* eslint @typescript-eslint/no-explicit-any: 0 */
import { Activity, NodeInfo } from "../props";
import { Agreement, OfferProposal, TerminationReason } from "../rest/market";
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
  private _offer_buffer: Map<string, _BufferedProposal> = new Map();
  private _agreements: Map<string, BufferedAgreement> = new Map();
  private _lock: Lock = new Lock();
  private _rejecting_providers: Set<string> = new Set();
  private _confirmed = 0;
  cancellation_token?: CancellationToken;

  constructor(emitter) {
    this.emitter = emitter;
  }

  async cycle(): Promise<void> {
    for (const agreement_id of new Map(this._agreements).keys()) {
      const buffered_agreement = this._agreements.get(agreement_id);
      if (buffered_agreement === undefined) {
        continue;
      }
      const task = buffered_agreement.worker_task;
      if (task && task.isFulfilled()) {
        /* reuse agreement if possible; workers that failed call this method with allow_reuse set to false */
        await this.release_agreement(buffered_agreement.agreement.id(), true);
      }
    }
  }

  async add_proposal(score: number, proposal: OfferProposal): Promise<void> {
    await asyncWith(this._lock, async () => {
      this._offer_buffer.set(proposal.issuer(), new _BufferedProposal(new Date(), score, proposal));
    });
  }

  async use_agreement(cbk: any): Promise<any> {
    let task;
    await asyncWith(this._lock, async () => {
      const agreement_with_info = await this._get_agreement();
      if (!agreement_with_info) return;
      const [agreement, node_info] = agreement_with_info;
      task = cbk(agreement, node_info);
      await this._set_worker(agreement.id(), task);
    });
    return { task };
  }

  async _set_worker(agreement_id: string, task: any): Promise<void> {
    const buffered_agreement = this._agreements.get(agreement_id);
    if (buffered_agreement === undefined) return;
    if (buffered_agreement.worker_task) throw "worker_task must be empty";
    buffered_agreement.worker_task = task;
  }

  private async _get_agreement(): Promise<[Agreement, NodeInfo] | undefined> {
    const emit = this.emitter;
    const available_agreements = [...this._agreements.values()].filter((agr) => agr.worker_task === undefined);
    if (available_agreements.length > 0) {
      const buffered_agreement = available_agreements[Math.floor(Math.random() * available_agreements.length)];
      logger.debug(`Reusing agreement. id: ${buffered_agreement.agreement.id()}`);
      return [buffered_agreement.agreement, buffered_agreement.node_info];
    }
    if (this._offer_buffer.size === 0) {
      return;
    }
    const _sample = [...this._offer_buffer.entries()]
      .map((x) => {
        return { obj: x, rnd: Math.random() };
      })
      .sort((a, b) => a.rnd - b.rnd)
      .map((x) => x.obj)
      .reduce((acc, item) => (item[1].score > acc[1].score ? item : acc));
    const [provider_id, offer] = _sample;
    this._offer_buffer.delete(provider_id);
    if (this.cancellation_token && this.cancellation_token.cancelled) return;
    try {
      const agreement = await offer.proposal.create_agreement();
      try {
        const agreement_details = await agreement.details();
        const provider_activity = <Activity>agreement_details.provider_view().extract(new Activity());
        const requestor_activity = <Activity>agreement_details.requestor_view().extract(new Activity());
        const node_info = <NodeInfo>agreement_details.provider_view().extract(new NodeInfo());
        logger.debug(`New agreement. id: ${agreement.id()}, provider: ${node_info.name.value}`);
        emit(
          new events.AgreementCreated({
            agr_id: agreement.id(),
            provider_id: provider_id,
            provider_info: node_info,
          })
        );
        if (this.cancellation_token && this.cancellation_token.cancelled) return;
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
        );
        emit(new events.AgreementConfirmed({ agr_id: agreement.id() }));
        this._confirmed += 1;
        return [agreement, node_info];
      } catch (error) {
        logger.debug(`Cannot get agreement details. id: ${agreement.id()}`);
        emit(new events.AgreementRejected({ agr_id: agreement.id() }));
        return;
      }
    } catch (e) {
      emit(
        new events.ProposalFailed({
          prop_id: offer.proposal.id(),
          reason: e.toString(),
        })
      );
      throw e;
    }
  }

  async release_agreement(agreement_id: string, allow_reuse = true): Promise<void> {
    await asyncWith(this._lock, async () => {
      const buffered_agreement = this._agreements.get(agreement_id);
      if (buffered_agreement === undefined) return;
      buffered_agreement.worker_task = undefined;
      // Check whether agreement can be reused
      if (!allow_reuse || !buffered_agreement.has_multi_activity) {
        const reason = { message: "Work cancelled", "golem.requestor.code": "Cancelled" };
        await this._terminate_agreement(agreement_id, reason);
      }
    });
  }

  private async _terminate_agreement(agreement_id: string, reason: TerminationReason): Promise<void> {
    const buffered_agreement = this._agreements.get(agreement_id);
    if (buffered_agreement === undefined) {
      logger.warn(`Trying to terminate agreement not in the pool. id: ${agreement_id}`);
      return;
    }
    logger.debug(`Terminating agreement. id: ${agreement_id}, reason: ${JSON.stringify(reason)}`);
    if (buffered_agreement.worker_task && buffered_agreement.worker_task.isPending()) {
      logger.debug(`Terminating agreement that still has worker. agr_id: ${buffered_agreement.agreement.id()}`);
      buffered_agreement.worker_task.cancel();
    }
    if (buffered_agreement.has_multi_activity) {
      if (!(await buffered_agreement.agreement.terminate(reason))) {
        logger.debug(`Couldn't terminate agreement. id: ${buffered_agreement.agreement.id()}`);
      }
    }
    this._agreements.delete(agreement_id);
    this.emitter(
      new events.AgreementTerminated({
        agr_id: agreement_id,
        reason: JSON.stringify(reason),
      })
    );
  }

  async terminate_all(reason: TerminationReason): Promise<void> {
    await asyncWith(this._lock, async () => {
      for (const agreement_id of new Map(this._agreements).keys()) {
        await this._terminate_agreement(agreement_id, reason);
      }
    });
  }

  rejected_last_agreement(provider_id: string): boolean {
    return this._rejecting_providers.has(provider_id);
  }
}
