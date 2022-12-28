import { AbstractAggregator } from "./abstract_aggregator";
import { Events } from "../events";

export interface AllocationInfo {
  id: string;
  amount: number;
  platform?: string;
}

export class Allocations extends AbstractAggregator<Events.AllocationCreated, AllocationInfo> {
  beforeAdd(item: Events.AllocationCreated): AllocationInfo {
    return item.detail;
  }
}
