/* eslint @typescript-eslint/ban-types: 0 */
import { as_list, Model, Field } from "./base";

export const SCHEME = "golem.com.scheme";
export const PRICE_MODEL = "golem.com.pricing.model";

export const LINEAR_COEFFS = "golem.com.pricing.model.linear.coeffs";
export const DEFINED_USAGES = "golem.com.usage.vector";

export enum BillingScheme {
  PAYU = "payu",
}

export enum PriceModel {
  LINEAR = "linear",
}

export enum Counter {
  TIME = "golem.usage.duration_sec",
  CPU = "golem.usage.cpu_sec",
  STORAGE = "golem.usage.storage_gib",
  MAXMEM = "golem.usage.gib",
  UNKNOWN = "",
}

export class Com extends Model {
  scheme: Field = new Field({ metadata: { key: SCHEME } }); //BillingScheme
  price_model: Field = new Field({ metadata: { key: PRICE_MODEL } }); //PriceModel
}

export class ComLinear extends Com {
  public fixed_price!: number;
  public price_for!: Object;

  _custom_mapping(props, data: any) {
    if (data["price_model"] != PriceModel.LINEAR) throw "expected linear pricing model";

    const coeffs = as_list(props[LINEAR_COEFFS]);
    const usages = as_list(props[DEFINED_USAGES]);

    const fixed_price = parseFloat(coeffs.pop() || "0");
    let price_for: object = {};
    for (let i = 0; i < coeffs.length; i++) {
      price_for = { ...price_for, [usages[i]]: parseFloat(coeffs[i]) };
    }

    data.fixed_price = fixed_price;
    data.price_for = price_for;
  }
}
