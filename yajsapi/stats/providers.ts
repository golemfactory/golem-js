import { AbstractAggregator } from "./abstract_aggregator";
import { Events } from "../events";

export interface ProviderInfo {
  id: string;
  providerName: string;
}

export class Providers extends AbstractAggregator<Events.AgreementCreated, ProviderInfo> {
  beforeAdd(event: Events.AgreementCreated): ProviderInfo {
    return { id: event.detail.providerId, providerName: event.detail.providerName };
  }
}
