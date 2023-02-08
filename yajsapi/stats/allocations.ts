import { AbstractAggregator } from './abstract_aggregator.js';

export interface AllocationInfo {
  id: string;
  amount: number;
  platform?: string;
}

interface Payload {
  id: string;
  amount: number;
  platform?: string;
}

export class Allocations extends AbstractAggregator<Payload, AllocationInfo> {
  beforeAdd(payload): AllocationInfo {
    return payload;
  }
}
