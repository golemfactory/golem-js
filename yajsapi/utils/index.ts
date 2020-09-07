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

  constructor(list = []) {
    this._tasks = list;
    if (list.length > 0) {
      let first = this._tasks.shift();
      first();
    }
  }

  put(item: T) {
    this._tasks.push(item);
  }

  async get(): Promise<T> {
    return new Promise(async (resolve) => {
      let item;
      while (!item) {
        item = this._tasks.shift();
        await sleep(1);
      }
      resolve(item);
    });
  }

  empty() {
    return this._tasks.length == 0;
  }
}
