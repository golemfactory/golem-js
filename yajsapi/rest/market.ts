import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Model } from "../props";
import { logger, sleep } from "../utils";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import * as models from "ya-ts-client/dist/ya-market/src/models";
import { Configuration } from "ya-ts-client/dist/ya-activity";
import { suppress_exceptions, is_intermittent_error } from "./common";

dayjs.extend(utc);

type _ModelType = Pick<Model, "from_properties"> & Partial<Model>;
export type TerminationReason = { "message": string, "golem.requestor.code"?: string };

class View {
  private _properties!: object;

  constructor(properties: object) {
    this._properties = properties;
  }

  extract(m: _ModelType): _ModelType {
    return m.from_properties(this._properties);
  }
}
class AgreementDetails extends Object {
  raw_details!: models.Agreement;

  constructor(_ref: models.Agreement) {
    super();
    this.raw_details = _ref;
  }

  provider_view(): View {
    let offer: models.Offer = this.raw_details.offer;
    return new View(offer.properties);
  }

  requestor_view(): View {
    let demand: models.Demand = this.raw_details.demand;
    return new View(demand.properties);
  }
}

export class Agreement {
  private _api;
  private _subscription;
  private _id;

  constructor(
    api: RequestorApi,
    subscription: Subscription,
    agreement_id: string
  ) {
    this._api = api;
    this._subscription = subscription;
    this._id = agreement_id;
  }

  id(): string {
    return this._id;
  }

  async details(): Promise<AgreementDetails> {
    let { data } = await this._api.getAgreement(this._id, { timeout: 3000 });
    return new AgreementDetails(data);
  }

  async confirm(): Promise<boolean> {
    try {
      await this._api.confirmAgreement(this._id, undefined, { timeout: 16000 });
    } catch (error) {
      logger.debug(`confirmAgreement(${this._id}) raised ApiException ${error}`);
      return false;
    }
    try {
      let { data: msg } = await this._api.waitForApproval(this._id, 15, { timeout: 16000 });
      return true;
    } catch (error) {
      logger.debug(`waitForApproval(${this._id}) raised ApiException ${error}`);
      return false;
    }
  }

  async terminate(reason: TerminationReason = { "message": "Finished" }): Promise<boolean> {
    try {
      await this._api.terminateAgreement(this._id, reason, { timeout: 5000 });
      logger.debug(`Terminated agreement ${this._id}.`);
      return true;
    } catch (error) {
      if (error.response && error.response.status === 410) {
        logger.debug(
          `terminateAgreement(${this._id}) raised ApiException: status = 410, message = ${error.message}`
        );
      } else {
        logger.debug(`terminateAgreement(${this._id}) raised ApiException`);
      }
      return false;
    }
  }
}

class mProposal implements models.Proposal {
  properties!: object;
  constraints!: string;
  proposalId!: string;
  issuerId!: string;
  state!: models.ProposalAllOfStateEnum;
  prevProposalId?: string;
  timestamp!: string;
}

class mDemandOfferBase implements models.DemandOfferBase {
  properties!: object;
  constraints!: string;
}

class mAgreementProposal implements models.AgreementProposal {
  proposalId!: string;
  validTo!: string;
}

export class OfferProposal {
  private _proposal!: models.ProposalEvent;
  private _subscription!: Subscription;

  constructor(subscription: Subscription, proposal: models.ProposalEvent) {
    this._proposal = proposal;
    this._subscription = subscription;
  }

  issuer(): string {
    return this._proposal.proposal!.issuerId || "";
  }

  id(): string {
    return this._proposal.proposal!.proposalId || "";
  }

  props() {
    return this._proposal.proposal!.properties;
  }

  state() {
    return this._proposal.proposal!.state;
  }

  is_draft(): boolean {
    return (
      this._proposal.proposal!.state == models.ProposalAllOfStateEnum.Draft
    );
  }

  async reject(_reason: string | null = null) {
    try {
      await this._subscription._api.rejectProposalOffer(
        this._subscription.id(),
        this.id(),
        { message: (_reason || "no reason") as Object },
        { timeout: 5000 }
      );
    } catch (e) {
      logger.debug(`Cannot reject offer ${this.id()}` + e.response.data.message);
      throw e;
    }
  }

  async respond(props: object, constraints: string): Promise<string> {
    let with_proposal: mDemandOfferBase = new mDemandOfferBase();
    with_proposal.properties = props;
    with_proposal.constraints = constraints;
    let {
      data: new_proposal,
    } = await this._subscription._api.counterProposalDemand(
      this._subscription.id(),
      this.id(),
      with_proposal,
      { timeout: 5000 }
    );
    return new_proposal;
  }

  // TODO: This timeout is for negotiation ?
  async create_agreement(timeout = 3600): Promise<Agreement> {
    let proposal: mAgreementProposal = new mAgreementProposal();
    proposal.proposalId = this.id();
    proposal.validTo = dayjs()
      .add(timeout, "second")
      .utc()
      .format("YYYY-MM-DD HH:mm:ss.SSSSSSZ");
    let api: RequestorApi = this._subscription._api;
    let { data: agreement_id } = await api.createAgreement(proposal, { timeout: 3000 });
    return new Agreement(api, this._subscription, agreement_id);
  }
}

export class Subscription {
  public _api: RequestorApi;
  private _id: string;
  private _open: boolean;
  private _deleted: boolean;
  private _details;

  constructor(
    api: RequestorApi,
    subscription_id: string,
    _details: models.Demand | null = null
  ) {
    this._api = api;
    this._id = subscription_id;
    this._open = true;
    this._deleted = false;
    this._details = _details;
  }

  id() {
    return this._id;
  }

  close() {
    this._open = false;
  }

  async ready(): Promise<this> {
    return this;
  }

  async done() {
    await this.delete();
  }

  details(): models.Demand {
    if (!this._details) throw "expected details on list object";
    return this._details;
  }

  async delete() {
    this._open = false;
    if (!this._deleted) {
      await this._api.unsubscribeDemand(this._id, { timeout: 3000 });
    }
  }

  async *events(cancellationToken?): AsyncGenerator<OfferProposal> {
    while (this._open) {
      if (cancellationToken && cancellationToken.cancelled) break;
      let proposals: any[] = [];
      try {
        await suppress_exceptions(is_intermittent_error, async () => {
          let { data } = await this._api.collectOffers(this._id, 3, 10, { timeout: 5000 });
          proposals = data;
        }, "collectOffers");
        for (let _proposal of proposals) {
          if (cancellationToken && cancellationToken.cancelled) return;
          if (_proposal.eventType === "ProposalEvent") {
            yield new OfferProposal(this, _proposal as models.ProposalEvent);
          }
        }
        if (!proposals.length) {
          await sleep(2);
        }
      } catch (error) {
        if (error.response && error.response.status === 404) {
          logger.debug(`Offer unsubscribed or its subscription expired, subscription_id: ${this._id}`);
          this._open = false;
          // Prevent calling `unsubscribe` which would result in API error for expired demand subscriptions
          this._deleted = true;
        } else {
          logger.error(`Error while collecting offers: ${error}`);
          throw error;
        }
      }
    }
    return;
  }
}

class mDemand implements models.Demand {
  demandId: string = "";
  requestorId: string = "";
  properties!: object;
  constraints!: string;
  timestamp!: string;
}

export class Market {
  private _api: RequestorApi;
  constructor(cfg: Configuration) {
    this._api = new RequestorApi(cfg);
  }

  subscribe(props: {}, constraints: string): Promise<Subscription> {
    let request: models.DemandOfferBase = new mDemandOfferBase();
    request.properties = props;
    request.constraints = constraints;
    let self = this;
    async function create(): Promise<Subscription> {
      try {
        let { data: sub_id } = await self._api.subscribeDemand(request, { timeout: 5000 });
        return new Subscription(self._api, sub_id);
      } catch (error) {
        logger.error(`Error while subscribing: ${error}`);
        throw error;
      }
    }

    return create();
  }

  async *subscriptions(): AsyncGenerator<Subscription> {
    try {
      let { data: demands } = await this._api.getDemands({ timeout: 3000 });
      for (let demand of demands) {
        yield new Subscription(this._api, demand.demandId as string, demand);
      }
    } catch (error) {
      logger.warn(`getDemands error: ${error}`);
    }
    return;
  }
}
