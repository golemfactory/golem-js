import { Proposal as ProposalModel } from "ya-ts-client/dist/ya-market/src/models";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market";
import { Offer } from "./offer";

export class Proposal extends Offer {
  constructor(
    protected readonly subscriptionId: string,
    private readonly api: RequestorApi,
    model: ProposalModel,
    private readonly demandRequest: DemandOfferBase
  ) {
    super(subscriptionId, model);
  }
  setScore(score: number) {
    this._score = score;
  }
  async reject(reason = "no reason") {
    // eslint-disable-next-line @typescript-eslint/ban-types
    await this.api.rejectProposalOffer(this.subscriptionId, this.proposalId, { message: reason as {} }).catch((e) => {
      throw new Error(e?.response?.data?.message || e);
    });
  }
  async respond() {
    await this.api.counterProposalDemand(this.subscriptionId, this.proposalId, this.demandRequest).catch((e) => {
      throw new Error(e?.response?.data?.message || e);
    });
  }
}
