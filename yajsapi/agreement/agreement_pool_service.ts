import { Logger } from "../utils";
import { OfferProposal, TerminationReason } from "../rest/market";
import { EventBus } from "../events/event_bus";
import { Agreement } from "./agreement";

export class AgreementPoolService {
  constructor(
    private readonly yagnaOptions: { apiKey?: string; apiUrl?: string },
    private readonly eventBus: EventBus,
    private readonly logger?: Logger
  ) {}
  async run() {
    this.logger?.info("The Agreement Pool Service has started");
  }
  async get(): Promise<Agreement> {
    return new Agreement("todo", { providerId: "todo", providerName: "todo" });
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

  async end() {
    // todo
  }
}
