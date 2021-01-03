import * as csp from "js-csp";
import { eventLoop } from "../utils";

type Item = "Item";

export class Handle<Item> {
  private _consumer: Consumer<Item> | null;
  private _data: Item;
  private _prev_consumers: Set<Consumer<Item>>;
  constructor({ data, consumer, ...rest }) {
    this._data = data;
    this._prev_consumers = new Set();
    if (!!consumer) this._prev_consumers.add(consumer);

    this._consumer = consumer;
  }

  consumer(): Consumer<Item> | null {
    return this._consumer;
  }

  assign_consumer(consumer: Consumer<Item>): void {
    this._prev_consumers.add(consumer);
    this._consumer = consumer;
  }

  data(): Item {
    return this._data;
  }
}

export class SmartQueue<Item> {
  private _items: Array<Item> | null;
  private _rescheduled_items: Set<Handle<Item>>;
  private _in_progress: Set<Handle<Item>>;
  private __new_items;
  private __eof;

  constructor(items: Array<Item>, retry_cnt: number = 2, ...rest) {
    this._items = items;
    this._rescheduled_items = new Set();
    this._in_progress = new Set();

    this.__new_items = csp.chan();
    this.__eof = csp.chan();
  }

  new_consumer(): Consumer<Item> {
    return new Consumer(this);
  }

  __have_data(): boolean {
    const have_data =
      !!(this._items && this._items.length) ||
      !!this._rescheduled_items.size ||
      !!this._in_progress.size;
    return have_data;
  }

  __find_rescheduled_item(consumer: Consumer<Item>): Handle<Item> | null {
    const items = [...this._rescheduled_items].map((handle: any) => {
      if (!handle._prev_consumers.has(consumer)) return handle;
    });
    return items[Symbol.iterator]().next().value;
  }

  async *get(
    consumer: Consumer<Item>,
    callback: Function | null | undefined
  ): AsyncGenerator<Handle<Item>> {
    while (this.__have_data()) {
      let handle = this.__find_rescheduled_item(consumer);
      if (!!handle) {
        this._rescheduled_items.delete(handle);
        this._in_progress.add(handle);
        handle.assign_consumer(consumer);
        callback && callback(handle);
        yield handle;
      }

      if (!!(this._items && this._items.length)) {
        let next_elem = this._items.pop();
        if (!next_elem) {
          this._items = null;
          if (!this._rescheduled_items && !this._in_progress) {
            csp.putAsync(this.__new_items, true);
            throw new Error();
          }
        } else {
          handle = new Handle({ data: next_elem, consumer: consumer });
          this._in_progress.add(handle);
          callback && callback(handle);
          yield handle;
        }
      }
      await promisify(csp.takeAsync)(this.__new_items);
    }
    // throw new Error(); //StopAsyncIteration
  }

  async mark_done(handle: Handle<Item>): Promise<void> {
    if (!this._in_progress.has(handle)) throw "handle is not in progress";
    this._in_progress.delete(handle);
    csp.putAsync(this.__eof, true);
    csp.putAsync(this.__new_items, true);
    // if _logger.isEnabledFor(logging.DEBUG):
    //     _logger.debug(
    //         f"status in-progress={len(self._in_progress)}, have_item={bool(self._items)}"
    //     )
  }

  async reschedule(handle: Handle<Item>): Promise<void> {
    if (!this._in_progress.has(handle)) throw "handle is not in progress";
    this._in_progress.delete(handle);
    this._rescheduled_items.add(handle);
    csp.putAsync(this.__new_items, true);
  }

  async reschedule_all(consumer: Consumer<Item>): Promise<void> {
    let handles = [...this._in_progress].map((handle) => {
      if (handle.consumer() === consumer) return handle;
    });
    for (let handle of handles) {
      if (handle) {
        this._in_progress.delete(handle);
        this._rescheduled_items.add(handle);
      }
    }
    csp.putAsync(this.__new_items, true);
  }

  stats(): object {
    return {
      items: !!this._items,
      "in-progress": this._in_progress.size,
      "rescheduled-items": this._rescheduled_items.size,
    };
  }

  async wait_until_done(): Promise<void> {
    while (this.__have_data()) {
      await promisify(csp.takeAsync)(this.__eof);
    }
  }

  has_unassigned_items(): boolean {
    return !!(this._items && this._items.length) || !!this._rescheduled_items.size
  }
}

export class Consumer<Item> {
  private _queue;
  private _fetched?: Handle<Item> | null;

  constructor(queue: SmartQueue<Item>) {
    this._queue = queue;
    this._fetched = null;
  }

  ready(): Consumer<Item> {
    return this;
  }

  done() {
    eventLoop().create_task(this._queue.reschedule_all.bind(this._queue, this));
    return null;
  }

  last_item(): Item | null {
    return this._fetched ? this._fetched.data() : null;
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Handle<Item>, any, any> {
    const _fetch = (handle: Handle<Item>) => (this._fetched = handle);
    const val = await this._queue.get(this, _fetch);
    yield* val;
  }
}

function promisify(fn) {
  return (...args) =>
    new Promise((resolve, reject) => {
      try {
        fn(...args, resolve);
      } catch (error) {
        reject(error);
      }
    });
}
