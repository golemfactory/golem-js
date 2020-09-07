import dayjs from "dayjs";
import { Market, Subscription } from "../rest/market";

export class DemandBuilder {
  public _props: Object;
  public _constraints: string[];
  constructor() {
    this._props = {};
    this._constraints = [];
  }

  props(): object {
    return this._props;
  }

  cons(): string {
    let c_list = this._constraints;
    let c_value: string;
    if (!c_list || c_list.length < 1) c_value = "()";
    else if (Object.keys(c_list).length == 1) c_value = c_list[0];
    else {
      let rules = c_list.join("\n\t");
      c_value = `(&${rules})`;
    }

    return c_value;
  }

  ensure(constraint: string): void {
    this._constraints.push(constraint);
  }

  add(m) {
    let kv = m.keys();

    for (let name of kv.names()) {
      let prop_id = kv.get()[name];
      let value = m[name].value;
      if (value == null) continue;
      if (dayjs.isDayjs(value)) value = value.valueOf();
      else if (value instanceof Object) {
        value = value.value;
        if (
          !(
            value instanceof String ||
            value instanceof Number ||
            value instanceof Array
          )
        )
          throw Error("");
      }
      this._props[prop_id] = value;
    }
  }

  async subscribe(market: Market): Promise<Subscription> {
    let result: Subscription = await market.subscribe(this.props(), this.cons());
    return result;
  }
}
