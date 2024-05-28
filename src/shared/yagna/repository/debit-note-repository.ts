import { DebitNote, IDebitNoteRepository } from "../../../payment/debit_note";
import { MarketApi, PaymentApi } from "ya-ts-client";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";
import { GolemPaymentError, PaymentErrorCode } from "../../../payment";
import { GolemMarketError, MarketErrorCode } from "../../../market";

export class DebitNoteRepository implements IDebitNoteRepository {
  constructor(
    private readonly paymentClient: PaymentApi.RequestorService,
    private readonly marketClient: MarketApi.RequestorService,
  ) {}

  async getById(id: string): Promise<DebitNote> {
    let model;
    let agreement;
    try {
      model = await this.paymentClient.getDebitNote(id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemPaymentError(
        `Failed to get debit note: ${message}`,
        PaymentErrorCode.CouldNotGetDebitNote,
        undefined,
        undefined,
        error,
      );
    }

    try {
      agreement = await this.marketClient.getAgreement(model.agreementId);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemMarketError(
        `Failed to get agreement for debit note: ${message}`,
        MarketErrorCode.CouldNotGetAgreement,
        error,
      );
    }

    const providerInfo = {
      id: model.issuerId,
      walletAddress: model.payeeAddr,
      name: agreement.offer.properties["golem.node.id.name"] ?? "",
    };

    return new DebitNote(model, providerInfo);
  }
}
