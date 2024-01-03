import { AbstractAggregator } from "./abstract_aggregator";

export interface InvoiceInfo {
  id: string;
  providerId: string;
  agreementId: string;
  payeeAddr: string;
  amount: number;
}
interface Payload {
  id: string;
  providerId: string;
  agreementId: string;
  payeeAddr: string;
  amount: number;
}

export class Invoices extends AbstractAggregator<Payload, InvoiceInfo> {
  beforeAdd(payload: Payload): InvoiceInfo {
    return payload;
  }
  getByProviderId(providerId: string) {
    return this.getByField("providerId", providerId);
  }
  getByAgreementId(agreementId: string) {
    return this.getByField("agreementId", agreementId);
  }
}
