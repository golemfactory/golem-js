import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market";
import { Events } from "../events";

export class Proposal {
  readonly id: string;
  readonly issuerId: string;
  readonly properties: object;
  readonly constraints: string;
  readonly timestamp: string;
  private readonly state: ProposalAllOfStateEnum;
  private readonly prevProposalId: string | undefined;
  private _score: number | null = null;

  /**
   * Create proposal for given subscription ID
   *
   * @param subscriptionId - subscription ID
   * @param api - {@link RequestorApi}
   * @param model - {@link ProposalModel}
   * @param demandRequest - {@link DemandOfferBase}
   * @param eventTarget - {@link EventTarget}
   */
  constructor(
    private readonly subscriptionId: string,
    private readonly api: RequestorApi, // TODO: why API explicitly?
    model: ProposalModel,
    private readonly demandRequest: DemandOfferBase,
    private eventTarget?: EventTarget
  ) {
    this.id = model.proposalId;
    this.issuerId = model.issuerId;
    this.properties = model.properties;
    this.constraints = model.constraints;
    this.state = model.state;
    this.prevProposalId = model.prevProposalId;
    this.timestamp = model.timestamp;
  }

  set score(score: number | null) {
    this._score = score;
  }

  get score(): number | null {
    return this._score;
  }

  isInitial(): boolean {
    return this.state === ProposalAllOfStateEnum.Initial;
  }

  isDraft(): boolean {
    return this.state === ProposalAllOfStateEnum.Draft;
  }

  isExpired(): boolean {
    return this.state === ProposalAllOfStateEnum.Expired;
  }

  isRejected(): boolean {
    return this.state === ProposalAllOfStateEnum.Rejected;
  }

  async reject(reason = "no reason") {
    // eslint-disable-next-line @typescript-eslint/ban-types
    await this.api.rejectProposalOffer(this.subscriptionId, this.id, { message: reason as {} }).catch((e) => {
      throw new Error(e?.response?.data?.message || e);
    });
    this.eventTarget?.dispatchEvent(new Events.ProposalRejected({ id: this.id, providerId: this.issuerId }));
  }

  async respond(chosenPlatform) {
    this.demandRequest.properties["golem.com.payment.chosen-platform"] = chosenPlatform;
    await this.api
      .counterProposalDemand(this.subscriptionId, this.id, this.demandRequest, { timeout: 20000 })
      .catch((e) => {
        throw new Error(e?.response?.data?.message || e);
      });
    this.eventTarget?.dispatchEvent(new Events.ProposalResponded({ id: this.id, providerId: this.issuerId }));
  }
}
