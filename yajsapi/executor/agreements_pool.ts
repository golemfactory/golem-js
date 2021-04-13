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
  worker_task: any;
  has_multi_activity: boolean;
  constructor(agreement: Agreement, node_info: NodeInfo, worker_task: any, has_multi_activity: boolean) {
    this.agreement = agreement;
    this.node_info = node_info;
    if (worker_task) this.worker_task = worker_task;
    this.has_multi_activity = has_multi_activity;
  }
}

class AgreementsPool {
  // TODO emitter;
  private _offer_buffer: Map<string, _BufferedProposal> = new Map();
  private _agreements: Map<string, BufferedAgreement> = new Map();
  // TODO _lock;
  private _rejecting_providers: Set<string> = new Set();
  private _confirmed: number = 0;
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
    /* TODO port to JS
    emit = self.emitter

    try:
        buffered_agreement = random.choice(
            [ba for ba in self._agreements.values() if ba.worker_task is None]
        )
        logger.debug("Reusing agreement. id: %s", buffered_agreement.agreement.id)
        return buffered_agreement.agreement, buffered_agreement.node_info
    except IndexError:  # empty pool
        pass

    try:
        offers = list(self._offer_buffer.items())
        # Shuffle the offers before picking one with the max score,
        # in case there's more than one with this score.
        random.shuffle(offers)
        provider_id, offer = max(offers, key=lambda elem: elem[1].score)
    except ValueError:  # empty pool
        return None
    del self._offer_buffer[provider_id]
    try:
        agreement = await offer.proposal.create_agreement()
    except asyncio.CancelledError:
        raise
    except Exception as e:
        exc_info = (type(e), e, sys.exc_info()[2])
        emit(events.ProposalFailed(prop_id=offer.proposal.id, exc_info=exc_info))
        raise
    agreement_details = await agreement.details()
    provider_activity = agreement_details.provider_view.extract(Activity)
    requestor_activity = agreement_details.requestor_view.extract(Activity)
    node_info = agreement_details.provider_view.extract(NodeInfo)
    logger.debug("New agreement. id: %s, provider: %s", agreement.id, node_info)
    emit(
        events.AgreementCreated(
            agr_id=agreement.id, provider_id=provider_id, provider_info=node_info
        )
    )
    if not await agreement.confirm():
        emit(events.AgreementRejected(agr_id=agreement.id))
        self._rejecting_providers.add(provider_id)
        return None
    self._rejecting_providers.discard(provider_id)
    self._agreements[agreement.id] = BufferedAgreement(
        agreement=agreement,
        node_info=node_info,
        worker_task=None,
        has_multi_activity=bool(
            provider_activity.multi_activity and requestor_activity.multi_activity
        ),
    )
    emit(events.AgreementConfirmed(agr_id=agreement.id))
    self.confirmed += 1
    return agreement, node_info
    */
    return;
  }
  async release_agreement(agreement_id: string, allow_reuse: boolean = true): Promise<void> {
    // TODO async with self._lock:
    const buffered_agreement = this._agreements[agreement_id];
    if (buffered_agreement === undefined) return;
    buffered_agreement.worker_task = undefined;
    // Check whether agreement can be reused
    if (!allow_reuse || !buffered_agreement.has_multi_activity) {
      const reason = { "message": "Work cancelled", "golem.requestor.code": "Cancelled" };
      await this._terminate_agreement(agreement_id, reason);
    }
  }
  private async _terminate_agreement(agreement_id: string, reason: object): Promise<void> {
    if (!this._agreements.has(agreement_id)) {
      // TODO logger.warning("Trying to terminate agreement not in the pool. id: ${agreement_id}")
      return;
    }
    const buffered_agreement: BufferedAgreement = this._agreements[agreement_id]
    const agreement_details = await buffered_agreement.agreement.details()
    // TODO const provider = agreement_details.provider_view.extract(NodeInfo)
    // TODO logger.debug("Terminating agreement. id: ${agreement_id}, reason: ${reason}, provider: ${provider}");
    if (buffered_agreement.worker_task && !buffered_agreement.worker_task.done()) { // TODO done() in JS
      /* TODO logger.debug(
        "Terminating agreement that still has worker. " +
        "agreement_id: ${buffered_agreement.agreement.id()}, worker: ${buffered_agreement.worker_task}"
      ); */
      buffered_agreement.worker_task.cancel(); // TODO cancel() in JS
    }
    if (buffered_agreement.has_multi_activity) {
      if (!(await buffered_agreement.agreement.terminate(reason.toString()))) {
        /* TODO logger.debug(
          "Couldn't terminate agreement. id=${buffered_agreement.agreement.id()}, provider=${provider}"
        );*/
      }
    }
    this._agreements.delete(agreement_id);
    /* TODO self.emitter(events.AgreementTerminated(agr_id=agreement_id, reason=reason)) */
  }
  async terminate_all(reason: object): Promise<void> {
    // TODO async with self._lock:
    for (const agreement_id of this._agreements.keys()) {
      await this._terminate_agreement(agreement_id, reason)
    }
  }
  async on_agreement_terminated(agr_id: string, reason: object): Promise<void> {
    // TODO async with self._lock:
    const buffered_agreement: BufferedAgreement = this._agreements[agr_id];
    if (buffered_agreement === undefined) return;
    if (buffered_agreement.worker_task) buffered_agreement.worker_task.cancel(); // TODO: cancel task in JS
    this._agreements.delete(agr_id);
    // TODO this.emitter(events.AgreementTerminated(agr_id=agr_id, reason=reason));
  }
  rejected_last_agreement(provider_id: string): boolean {
    return this._rejecting_providers.has(provider_id);
  }
}
