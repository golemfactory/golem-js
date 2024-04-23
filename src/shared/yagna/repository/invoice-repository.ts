import { IInvoiceRepository, Invoice } from "../../../payment/invoice";
import { MarketApi, PaymentApi } from "ya-ts-client";
import { ProposalProperties } from "../../../market/proposal";

export class InvoiceRepository implements IInvoiceRepository {
  constructor(
    private readonly paymentClient: PaymentApi.RequestorService,
    private readonly marketClient: MarketApi.RequestorService,
  ) {}

  async getById(id: string): Promise<Invoice> {
    const model = await this.paymentClient.getInvoice(id);
    const agreement = await this.marketClient.getAgreement(model.agreementId);

    const providerInfo = {
      id: model.issuerId,
      walletAddress: model.payeeAddr,
      name: (agreement.offer.properties as ProposalProperties)["golem.node.id.name"],
    };

    return new Invoice(model, providerInfo);
  }
}
