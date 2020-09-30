export const sleep = (time) =>
  new Promise((resolve) => setTimeout(resolve, time * 1000));

export function getAllProperties(obj: any) {
  var allProps: any = [],
    curr = obj;
  do {
    var props = Object.getOwnPropertyNames(curr);
    props.forEach(function (prop) {
      if (allProps.indexOf(prop) === -1) allProps.push(prop);
    });
  } while ((curr = Object.getPrototypeOf(curr)));
  return allProps;
}

export function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      Object.defineProperty(
        derivedCtor.prototype,
        name,
        Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || ""
      );
    });
  });
}

export interface Queue<T> {}
export class Queue<T> {
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
        if(this._cancellationToken.cancelled) break;
        item = this._tasks.shift();
        if (!item) await sleep(2);
      }
      if(this._cancellationToken.cancelled) reject();
      resolve(item);
    });
  }

  empty() {
    return this._tasks.length == 0;
  }
}

export function range(start: number, end: number, step: number = 1): number[] {
  let list: number[] = [];
  for (let index = start; index < end; index += step) list.push(index);
  return list;
}
