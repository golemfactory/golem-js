import { AbstractAggregator } from "./abstract_aggregator";

export interface ProviderInfo {
  id: string;
  providerName: string;
}
interface Payload {
  id: string;
  providerName?: string;
}

function isProviderInfo(item: ProviderInfo | Payload): item is ProviderInfo {
  return (item as ProviderInfo).providerName !== undefined;
}

export class Providers extends AbstractAggregator<Payload, ProviderInfo> {
  beforeAdd(payload: Payload): ProviderInfo {
    if (isProviderInfo(payload)) {
      return payload;
    }

    const provider = this.getById(payload.id);
    return {
      id: payload.id,
      providerName: provider?.providerName || "unknown",
    };
  }
}
