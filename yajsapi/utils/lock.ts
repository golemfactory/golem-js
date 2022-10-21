import * as csp from "./../utils/csp";
import promisify from "./promisify";

export class Lock {
  private _lock: any;
  constructor() {
    this._lock = csp.chan('lock');
    csp.putAsync(this._lock, true);
  }
  async ready(): Promise<this> {
    await promisify(csp.takeAsync)(this._lock);
    return this;
  }
  async done() {
    csp.putAsync(this._lock, true);
  }
}
