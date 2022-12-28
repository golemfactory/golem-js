import { AbstractAggregator } from "./abstract_aggregator";

export interface ProviderInfo {
  id: string;
  providerName: string;
}
interface Payload {
  id: string;
  providerName: string;
}

export class Providers extends AbstractAggregator<Payload, ProviderInfo> {
  beforeAdd(payload): ProviderInfo {
    return payload;
  }
}
