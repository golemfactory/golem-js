import { AbstractAggregator } from "./abstract_aggregator";
import { ProviderInfo } from "../agreement";

export interface InvoiceInfo {
  id: string;
  agreementId: string;
  amount: number;
  provider: ProviderInfo;
}
interface Payload {
  id: string;
  agreementId: string;
  amount: number;
  provider: ProviderInfo;
}

export class Invoices extends AbstractAggregator<Payload, InvoiceInfo> {
  beforeAdd(payload: Payload): InvoiceInfo {
    return payload;
  }
  getByProviderId(providerId: string) {
    return this.getByField("provider.id", providerId);
  }
  getByAgreementId(agreementId: string) {
    return this.getByField("agreementId", agreementId);
  }
}
