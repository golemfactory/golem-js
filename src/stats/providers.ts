import { AbstractAggregator } from "./abstract_aggregator";

export interface ProviderInfo {
  id: string;
  name: string;
  walletAddress: string;
}
interface Payload {
  id: string;
  name: string;
  walletAddress: string;
}

export class Providers extends AbstractAggregator<Payload, ProviderInfo> {
  beforeAdd(payload: Payload): ProviderInfo {
    return payload;
  }
}
