import { Logger } from "../utils";
import { Agreement, OfferProposal, TerminationReason } from "../rest/market";

export class AgreementPoolService {
  constructor(private logger?: Logger) {}
  async run() {
    this.logger?.info("Agreement Pool Service started");
  }
  async get(): Promise<Agreement> {
    // todo
  }
  async releaseAgreement(agreementId: string) {
    // todo
  }
  async terminateAll(reason: TerminationReason) {
    // todo
  }
  async addProposal(score: number, proposal: OfferProposal) {
    // todo
  }

  async end() {}
}
