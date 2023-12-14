import { AbstractAggregator } from "./abstract_aggregator";

export interface ProviderInfo {
  id: string;
  providerName: string;
}
interface Payload {
  id: string;
  providerName?: string;
}

export class Providers extends AbstractAggregator<Payload, ProviderInfo> {
  beforeAdd(payload: Payload): ProviderInfo {
    if (payload.providerName) {
      return payload as ProviderInfo;
    }

    const provider = this.getById(payload.id);
    return {
      id: payload.id,
      providerName: provider?.providerName || "unknown",
    };
  }
}
