import { Logger } from "../utils";
import { EventBus } from "./eventBus";
import { AgreementsPool as AgreementPoolOld } from "./agreements_pool";
import { Agreement, OfferProposal, TerminationReason } from "../rest/market";

export class AgreementsPool {
  private agreementPoolOld: AgreementPoolOld;
  constructor(private eventBus: EventBus, private logger?: Logger) {
    this.agreementPoolOld = new AgreementPoolOld(eventBus, logger);
  }
  async get(): Promise<Agreement> {
    return new Promise((res) => this.agreementPoolOld.use_agreement((agr) => res(agr)));
  }
  async releaseAgreement(agreementId: string) {
    await this.agreementPoolOld.release_agreement(agreementId);
  }
  async terminateAll(reason: TerminationReason) {
    await this.agreementPoolOld.terminate_all(reason);
  }
  async addProposal(score: number, proposal: OfferProposal) {
    return this.agreementPoolOld.add_proposal(score, proposal);
  }
}
