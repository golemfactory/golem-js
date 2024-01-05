import { AbstractAggregator } from "./abstract_aggregator";
import { ProviderInfo } from "../agreement";

export interface PaymentInfo {
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

export class Payments extends AbstractAggregator<Payload, PaymentInfo> {
  beforeAdd(payload: Payload): PaymentInfo {
    return payload;
  }
  getByProviderId(providerId: string) {
    return this.getByField("provider.id", providerId);
  }

  getByAgreementId(agreementId: string) {
    return this.getByField("agreementId", agreementId);
  }
}
