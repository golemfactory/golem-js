import { Proposal as ProposalModel, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { SCORE_NEUTRAL } from "./strategy";
import { Demand } from "./demand";

export class Offer {
  public readonly proposalId: string;
  public readonly issuerId: string;
  public readonly properties: object;
  public readonly constraints: string;
  protected state: ProposalAllOfStateEnum;
  protected prevProposalId: string | undefined;
  protected timestamp: string;
  protected score = 0;

  constructor(protected readonly subscriptionId: string, model: ProposalModel, protected demand: Demand) {
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
    this.score = score;
  }
  isAcceptable(): { result: boolean; reason?: string } {
    if (this.score < SCORE_NEUTRAL) {
      return { result: false, reason: "Score too low" };
    }
    if (!this.getCommonPaymentPlatform()) {
      return { result: false, reason: "No common payment platforms" };
    }
    return { result: true };
  }
  async reject(reason = "no reason") {
    await this.api.rejectProposalOffer(this.subscriptionId, this.proposalId, { message: { reason } }).catch((e) => {
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
