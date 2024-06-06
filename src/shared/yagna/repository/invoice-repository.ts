import { IInvoiceRepository, Invoice } from "../../../payment/invoice";
import { MarketApi, PaymentApi } from "ya-ts-client";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";
import { GolemPaymentError, PaymentErrorCode } from "../../../payment";
import { GolemMarketError, MarketErrorCode } from "../../../market";

export class InvoiceRepository implements IInvoiceRepository {
  constructor(
    private readonly paymentClient: PaymentApi.RequestorService,
    private readonly marketClient: MarketApi.RequestorService,
  ) {}

  async getById(id: string): Promise<Invoice> {
    let model;
    let agreement;
    try {
      model = await this.paymentClient.getInvoice(id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemPaymentError(
        `Failed to get debit note: ${message}`,
        PaymentErrorCode.CouldNotGetInvoice,
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
        `Failed to get agreement for invoice: ${message}`,
        MarketErrorCode.CouldNotGetAgreement,
        error,
      );
    }
    const providerInfo = {
      id: model.issuerId,
      walletAddress: model.payeeAddr,
      name: agreement.offer.properties["golem.node.id.name"],
    };

    return new Invoice(model, providerInfo);
  }
}
