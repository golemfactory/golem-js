import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { SCORE_NEUTRAL } from "./strategy";
import { Demand } from "./demand";
import { AgreementProposal } from "../agreement/agreement_pool_service";

export class Offer implements AgreementProposal {
  public readonly proposalId: string;
  public readonly issuerId: string;
  public readonly properties: object;
  public readonly constraints: string;
  public readonly timestamp: string;
  protected readonly state: ProposalAllOfStateEnum;
  protected readonly prevProposalId: string | undefined;
  protected _score?: number;
  private _isUsed = false;

  constructor(protected readonly subscriptionId: string, model: ProposalModel, protected demand: Demand) {
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

  get isUsed(): boolean {
    return this._isUsed;
  }

  markAsUsed(): void {
    this._isUsed = true;
  }
}

export class Proposal extends Offer {
  constructor(
    protected readonly subscriptionId: string,
    model: ProposalModel,
    protected demand: Demand,
    private api: RequestorApi,
    private allowedPlatforms: string[]
  ) {
    super(subscriptionId, model, demand);
    const commonPaymentPlatform = this.getCommonPaymentPlatform();
    if (commonPaymentPlatform) this.demand.addProperty("golem.com.payment.chosen-platform", commonPaymentPlatform);
  }
  setScore(score: number) {
    this._score = score;
  }
  isAcceptable(): { result: boolean; reason?: string } {
    if ((this.score || 0) < SCORE_NEUTRAL) {
      return { result: false, reason: "Score too low" };
    }
    if (!this.getCommonPaymentPlatform()) {
      return { result: false, reason: "No common payment platforms" };
    }
    return { result: true };
  }
  async reject(reason = "no reason") {
    // eslint-disable-next-line @typescript-eslint/ban-types
    await this.api.rejectProposalOffer(this.subscriptionId, this.proposalId, { message: reason as {} }).catch((e) => {
      throw new Error(e?.response?.data?.message || e);
    });
  }
  async respond() {
    await this.api
      .counterProposalDemand(this.subscriptionId, this.proposalId, this.demand.getDemandRequest())
      .catch((e) => {
        throw new Error(e?.response?.data?.message || e);
      });
  }
  private getCommonPaymentPlatform(): string | undefined {
    const providerPlatforms = Object.keys(this.properties)
      .filter((prop) => prop.startsWith("golem.com.payment.platform."))
      .map((prop) => prop.split(".")[4]) || ["NGNT"];
    return this.allowedPlatforms.find((p) => providerPlatforms.includes(p));
  }
}
