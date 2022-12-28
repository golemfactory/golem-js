export interface ItemInfo {
  id: string;
}

export abstract class AbstractAggregator<T, R extends ItemInfo> {
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
    const item = this.items.get(id);
    if (!item) return;
    this.items?.set(id, {
      ...item,
      ...data,
    });
  }
  getAll() {
    return [...this.items.values()];
  }
}
