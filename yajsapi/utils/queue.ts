import * as csp from "js-csp";
import promisify from "./promisify";

export default interface Queue<T> {}
export default class Queue<T> {
  private _tasks;
  private __new_items;

  constructor(list = []) {
    this._tasks = list;
    this.__new_items = csp.chan();

    if (list.length > 0) {
      let first = this._tasks.shift();
      first();
    }
  }

  put(item: T) {
    if (item === undefined || item === null || this.__new_items.closed) return;
    this._tasks.push(item);
    csp.putAsync(this.__new_items, true);
  }

  async get(): Promise<T> {
    return new Promise(async (resolve, reject) => {
      if (this.__new_items.closed) reject("new_items channel interrupted");
      try {
        await promisify(csp.takeAsync)(this.__new_items);
        let item = this._tasks.shift();
        resolve(item);
      } catch (error) {
        reject(error);
      }
    });
  }

  empty() {
    return this._tasks.length === 0;
  }

  close() {
    this.__new_items.close();
  }
}
