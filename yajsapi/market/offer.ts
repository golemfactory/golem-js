import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";

export class Offer {
  protected proposalId: string;
  protected issuerId: string;
  protected properties: object;
  protected constraints: string;
  protected state: ProposalAllOfStateEnum;
  protected prevProposalId: string | undefined;
  protected timestamp: string;
  protected score?: number;

  constructor(protected readonly subscriptionId: string, model: ProposalModel) {
    this.proposalId = model.proposalId;
    this.issuerId = model.issuerId;
    this.properties = model.properties;
    this.constraints = model.constraints;
    this.state = model.state;
    this.prevProposalId = model.prevProposalId;
    this.timestamp = model.timestamp;
  }
}

export class Proposal extends Offer {
  constructor(protected readonly subscriptionId: string, model: ProposalModel, private api: RequestorApi) {
    super(subscriptionId, model);
  }
  setScore(score: number) {
    this.score = score;
  }
  isAcceptable(): boolean {
    // TODO
    return true;
  }
  async reject(reason = "no reason") {
    await this.api.rejectProposalOffer(this.subscriptionId, this.proposalId, { message: { reason } });
  }
  async respond() {
    await this.api.counterProposalDemand()
  }
}
