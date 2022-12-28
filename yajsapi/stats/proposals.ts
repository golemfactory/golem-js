import { AbstractAggregator } from "./abstract_aggregator";

export interface ProposalInfo {
  id: string;
  providerId: string;
}
interface Payload {
  id: string;
  providerId: string;
}

export class Proposals extends AbstractAggregator<Payload, ProposalInfo> {
  beforeAdd(payload): ProposalInfo {
    return payload;
  }
}
