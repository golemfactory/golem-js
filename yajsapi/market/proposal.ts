import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models/index.js";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api.js";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market/index.js";
import { Events } from "../events/index.js";

/**
 * Proposal module - an object representing an offer in the state of a proposal from the provider.
 * @category Mid-level
 */
export class Proposal {
  id: string;
  readonly issuerId: string;
  readonly properties: object;
  readonly constraints: string;
  readonly timestamp: string;
  counteringProposalId: string | null;
  private readonly state: ProposalAllOfStateEnum;
  private readonly prevProposalId: string | undefined;
  private _score: number | null = null;

  /**
   * Create proposal for given subscription ID
   *
   * @param subscriptionId - subscription ID
   * @param parentId - Previous proposal ID with Initial state
   * @param api - {@link RequestorApi}
   * @param model - {@link ProposalModel}
   * @param demandRequest - {@link DemandOfferBase}
   * @param eventTarget - {@link EventTarget}
   */
  constructor(
    private readonly subscriptionId: string,
    private readonly parentId: string | null,
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
    this.counteringProposalId = null;
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

  async respond(chosenPlatform: string) {
    this.demandRequest.properties["golem.com.payment.chosen-platform"] = chosenPlatform;
    const { data: proposalId } = await this.api
      .counterProposalDemand(this.subscriptionId, this.id, this.demandRequest, { timeout: 20000 })
      .catch((e) => {
        throw new Error(e?.response?.data?.message || e);
      });
    this.counteringProposalId = proposalId;
    this.eventTarget?.dispatchEvent(
      new Events.ProposalResponded({ id: this.id, providerId: this.issuerId, parentId: this.parentId })
    );
    return proposalId;
  }
}
