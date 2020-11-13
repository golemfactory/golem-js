import sleep from "./sleep";
export default interface Queue<T> {}
export default class Queue<T> {
  private _tasks;
  private _cancellationToken;

  constructor(list = [], cancellationToken) {
    this._tasks = list;
    this._cancellationToken = cancellationToken;
    if (list.length > 0) {
      let first = this._tasks.shift();
      first();
    }
  }

  put(item: T) {
    this._tasks.push(item);
  }

  async get(): Promise<T> {
    return new Promise(async (resolve, reject) => {
      let item;
      while (!item) {
        if (this._cancellationToken.cancelled) break;
        item = this._tasks.shift();
        if (!item) await sleep(2);
      }
      if (this._cancellationToken.cancelled) reject();
      resolve(item);
    });
  }

  empty() {
    return this._tasks.length === 0;
  }
}
