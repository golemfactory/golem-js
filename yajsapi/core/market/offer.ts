import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models";

export class Offer {
  public readonly proposalId: string;
  public readonly issuerId: string;
  public readonly properties: object;
  public readonly constraints: string;
  public readonly timestamp: string;
  protected readonly state: ProposalAllOfStateEnum;
  protected readonly prevProposalId: string | undefined;
  protected _score?: number;

  constructor(protected readonly subscriptionId: string, model: ProposalModel) {
    this.proposalId = model.proposalId;
    this.issuerId = model.issuerId;
    this.properties = model.properties;
    this.constraints = model.constraints;
    this.state = model.state;
    this.prevProposalId = model.prevProposalId;
    this.timestamp = model.timestamp;
  }

  get score(): number {
    return this._score || 0;
  }
}
