import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Model } from "../props";
import { logger, sleep } from "../utils";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import * as models from "ya-ts-client/dist/ya-market/src/models";
import { Configuration } from "ya-ts-client/dist/ya-activity";

dayjs.extend(utc);

class AgreementDetails extends Object {
  raw_details!: models.Agreement;

  constructor(_ref: models.Agreement) {
    super();
    this.raw_details = _ref;
  }

  view_prov(c: Model): Model {
    let offer: models.Offer = this.raw_details.offer;
    return c.from_props(offer.properties);
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
    let { data } = await this._api.getAgreement(this._id);
    return new AgreementDetails(data);
  }

  async confirm(): Promise<boolean> {
    await this._api.confirmAgreement(this._id);
    let { data: msg } = await this._api.waitForApproval(this._id, 90, 100);
    return msg.trim().toLowerCase() == "approved";
  }
}

class mProposal implements models.Proposal {
  properties!: object;
  constraints!: string;
  proposalId?: string;
  issuerId?: string;
  state?: models.ProposalAllOfStateEnum;
  prevProposalId?: string;
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

  is_draft(): boolean {
    return (
      this._proposal.proposal!.state == models.ProposalAllOfStateEnum.Draft
    );
  }

  async reject(_reason: string | null = null) {
    await this._subscription._api.rejectProposalOffer(
      this._subscription.id(),
      this.id()
    );
  }

  async respond(props: object, constraints: string): Promise<string> {
    let proposal: mProposal = new mProposal();
    proposal.properties = props;
    proposal.constraints = constraints;
    let {
      data: new_proposal,
    } = await this._subscription._api.counterProposalDemand(
      this._subscription.id(),
      this.id(),
      proposal
    );
    return new_proposal;
  }

  // TODO: This timeout is for negotiation ?
  async agreement(timeout = 3600): Promise<Agreement> {
    let proposal: mAgreementProposal = new mAgreementProposal();
    proposal.proposalId = this.id();
    proposal.validTo = dayjs()
      .add(timeout, "second")
      .utc()
      .format("YYYY-MM-DD HH:mm:ss.SSSSSSZ");
    let api: RequestorApi = this._subscription._api;
    let { data: agreement_id } = await api.createAgreement(proposal);
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
      await this._api.unsubscribeDemand(this._id);
    }
  }

  async *events(cancellationToken?): AsyncGenerator<OfferProposal> {
    while (this._open) {
      if(cancellationToken && cancellationToken.cancelled) break;
      try {
        let { data: proposals } = await this._api.collectOffers(
          this._id,
          10,
          10
        );
        for (let _proposal of proposals) {
          yield new OfferProposal(this, _proposal as models.ProposalEvent);
        }
        if (!proposals || !proposals.length) {
          await sleep(2);
        }
      } catch (error) {
        logger.error(error);
        throw Error(error);
      }
    }
    return;
  }
}

class mDemand implements models.Demand {
  demandId?: string = "";
  requestorId?: string = "";
  properties!: object;
  constraints!: string;
}

export class Market {
  private _api: RequestorApi;
  constructor(cfg: Configuration) {
    this._api = new RequestorApi(cfg);
  }

  subscribe(props: {}, constraints: string): Promise<Subscription> {
    let request: models.Demand = new mDemand();
    request.properties = props;
    request.constraints = constraints;
    let self = this;
    async function create(): Promise<Subscription> {
      try {
        let { data: sub_id } = await self._api.subscribeDemand(request);
        return new Subscription(self._api, sub_id);
      } catch (error) {
        logger.error(error);
        throw new Error(error);
      }
    }

    return create();
  }

  async *subscriptions(): AsyncGenerator<Subscription> {
    try {
      let { data: demands } = await this._api.getDemands();
      for (let demand of demands) {
        yield new Subscription(this._api, demand.demandId as string, demand);
      }
    } catch (error) {
      logger.warn(`getDemands error: ${error}`);
    }
    return;
  }
}
