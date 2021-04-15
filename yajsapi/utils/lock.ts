import * as csp from "js-csp";
import { promisify } from "util";

export class Lock {
  private _lock: any;
  constructor() {
    this._lock = csp.chan();
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
