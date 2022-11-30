import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market";

export class Proposal {
  public readonly proposalId: string;
  public readonly issuerId: string;
  public readonly properties: object;
  public readonly constraints: string;
  public readonly timestamp: string;
  private readonly state: ProposalAllOfStateEnum;
  private readonly prevProposalId: string | undefined;
  private _score: number | null = null;

  constructor(
    private readonly subscriptionId: string,
    private readonly api: RequestorApi,
    model: ProposalModel,
    private readonly demandRequest: DemandOfferBase
  ) {
    this.proposalId = model.proposalId;
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
    await this.api.rejectProposalOffer(this.subscriptionId, this.proposalId, { message: reason as {} }).catch((e) => {
      throw new Error(e?.response?.data?.message || e);
    });
  }

  async respond(chosenPlatform) {
    this.demandRequest.properties["golem.com.payment.chosen-platform"] = chosenPlatform;
    await this.api.counterProposalDemand(this.subscriptionId, this.proposalId, this.demandRequest).catch((e) => {
      throw new Error(e?.response?.data?.message || e);
    });
  }
}
