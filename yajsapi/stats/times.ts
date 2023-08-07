import { AbstractAggregator, ItemInfo } from './abstract_aggregator';

export interface TimesInfo extends ItemInfo {
  startTime: number;
  stopTime: number;
  duration: number;
}

interface Payload {
  id: string;
  startTime: number;
  stopTime?: number;
}

export class Times extends AbstractAggregator<Payload, TimesInfo> {
  beforeAdd({ id, startTime, stopTime }: Payload): TimesInfo {
    return { id, stopTime: stopTime || 0, startTime, duration: stopTime ? stopTime - startTime : 0 };
  }

  stop({ id, stopTime }) {
    const item = this.items.get(id);
    this.updateItemInfo(id, { stopTime, duration: item?.startTime ? stopTime - item.startTime : 0 });
  }
}
