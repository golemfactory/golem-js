import { DebitNote, IDebitNoteRepository } from "../../../payment/debit_note";
import { MarketApi, PaymentApi } from "ya-ts-client";
import { ProposalProperties } from "../../../market/proposal";

export class DebitNoteRepository implements IDebitNoteRepository {
  constructor(
    private readonly paymentClient: PaymentApi.RequestorService,
    private readonly marketClient: MarketApi.RequestorService,
  ) {}

  async getById(id: string): Promise<DebitNote> {
    const model = await this.paymentClient.getDebitNote(id);
    const agreement = await this.marketClient.getAgreement(model.agreementId);

    const providerInfo = {
      id: model.issuerId,
      walletAddress: model.payeeAddr,
      name: (agreement.offer.properties as ProposalProperties)["golem.node.id.name"],
    };

    return new DebitNote(model, providerInfo);
  }
}
