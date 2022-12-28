import { AbstractAggregator } from "./abstract_aggregator";

export interface DebitNoteInfo {
  id: string;
}

export class DebitNotes extends AbstractAggregator<DebitNoteInfo> {}
