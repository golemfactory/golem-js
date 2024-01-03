import { AbstractAggregator } from "./abstract_aggregator";

export interface PaymentInfo {
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

export class Payments extends AbstractAggregator<Payload, PaymentInfo> {
  beforeAdd(payload: Payload): PaymentInfo {
    return payload;
  }
  getByProviderId(providerId: string) {
    return this.getByField("providerId", providerId);
  }

  getByAgreementId(agreementId: string) {
    return this.getByField("agreementId", agreementId);
  }
}
