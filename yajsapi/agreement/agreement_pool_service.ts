import { Logger, sleep } from "../utils";
import { EventBus } from "../executor/event_bus";
import { AgreementsPool as AgreementPoolOld } from "../executor/agreements_pool";
import { Agreement, OfferProposal, TerminationReason } from "../rest/market";

export class AgreementPoolService {
  private agreementPoolOld: AgreementPoolOld;
  constructor(private eventBus: EventBus, private logger?: Logger) {
    this.agreementPoolOld = new AgreementPoolOld(eventBus, logger);
  }
  async get(): Promise<Agreement> {
    let agreement;
    while (!agreement) {
      await sleep(2);
      await this.agreementPoolOld.use_agreement((agr) => (agreement = agr));
    }
    return agreement;
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

  // TODO: to refactor
  rejected_last_agreement(provider_id: string): boolean {
    return this.agreementPoolOld.rejected_last_agreement(provider_id);
  }
}
