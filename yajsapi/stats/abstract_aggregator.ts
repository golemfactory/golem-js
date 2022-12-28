import { BaseEvent, Events } from "../events";

export interface ItemInfo {
  id: string;
}

export abstract class AbstractAggregator<T extends BaseEvent<any>, R extends ItemInfo> {
  protected items = new Map<string, R>();
  add(event: T) {
    const item = this.beforeAdd(event);
    this.items.set(item.id, item);
  }
  abstract beforeAdd(item: T): R;
  getById(id: string) {
    return this.items.get(id);
  }
  protected getByField(field: string, value: string | number): R[] {
    try {
      return [...this.items.values()].filter((item: R) => item[field] === value);
    } catch {
      return [];
    }
  }
  protected updateItemInfo(id: string, data) {
    if (this.items.has(id)) {
      const item = this.items.get(id);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.items.set(id, {
        ...item,
        ...data,
      });
    }
  }
}
