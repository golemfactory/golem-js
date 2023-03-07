import { AbstractAggregator } from './abstract_aggregator.js';
import { Events } from '../events/index.js';

export interface InvoiceInfo {
  id: string;
  providerId: string;
  agreementId: string;
  amount: number;
}
interface Payload {
  id: string;
  providerId: string;
  agreementId: string;
  amount: string;
}

export class Invoices extends AbstractAggregator<Payload, InvoiceInfo> {
  beforeAdd(payload): InvoiceInfo {
    return {
      ...payload,
      amount: parseFloat(payload.amount),
    };
  }
  getByProviderId(providerId: string) {
    return this.getByField("providerId", providerId);
  }
  getByAgreementId(agreementId: string) {
    return this.getByField("agreementId", agreementId);
  }
}
