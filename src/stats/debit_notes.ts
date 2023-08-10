import { AbstractAggregator } from "./abstract_aggregator";

export interface DebitNoteInfo {
  id: string;
}
interface Payload {
  id: string;
  amount: number;
}

export class DebitNotes extends AbstractAggregator<Payload, DebitNoteInfo> {
  beforeAdd(item): DebitNoteInfo {
    return item;
  }
}
