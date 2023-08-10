import { AbstractAggregator } from "./abstract_aggregator";

export interface PaymentInfo {
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

export class Payments extends AbstractAggregator<Payload, PaymentInfo> {
  beforeAdd(payload): PaymentInfo {
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
