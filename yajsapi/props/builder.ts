import dayjs from "dayjs";
import { Market, Subscription } from "../rest/market";

/**
 * Builds an object of properties and constraints from high-level models.
 * @example
 * @description The object represents a Demand object, which is later matched by the new Golem's
    market implementation against Offers coming from providers to find those providers
    who can satisfy the requestor's demand.
 * 
 * @example TODO
 * 
 */
export class DemandBuilder {
  public _properties: Object;
  public _constraints: string[];
  constructor() {
    this._properties = {};
    this._constraints = [];
  }

  // List of properties for this demand.
  properties(): object {
    return this._properties;
  }

  // List of constraints for this demand.
  constraints(): string {
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

  // Add a constraint to the demand definition.
  ensure(constraint: string): void {
    this._constraints.push(constraint);
  }

  // Add properties from the specified model to this demand definition.
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
      this._properties[prop_id] = value;
    }
  }

  // Create a Demand on the market and subscribe to Offers that will match that Demand.
  async subscribe(market: Market): Promise<Subscription> {
    let result: Subscription = await market.subscribe(this.properties(), this.constraints());
    return result;
  }
}
