import { AbstractAggregator } from "./abstract_aggregator";
import { Events } from "../events";

export interface ProposalInfo {
  id: string;
  providerId: string;
}

export class Proposals extends AbstractAggregator<Events.ProposalReceived, ProposalInfo> {
  beforeAdd(event: Events.ProposalReceived): ProposalInfo {
    return event.detail;
  }
}
