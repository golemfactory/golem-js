import { MarketDecoration, MarketProperty } from "ya-ts-client/dist/ya-payment/src/models";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market/src/models";

export class Demand {
  private properties: Array<MarketProperty> = [];
  private constraints: Array<string> = [];

  constructor(private readonly decorations: MarketDecoration[]) {
    for (const decoration of this.decorations) {
      this.constraints.push(...decoration.constraints);
      this.properties.push(...decoration.properties);
    }
  }

  addProperty(key, value) {
    this.properties[key] = value;
  }

  getDemandRequest(): DemandOfferBase {
    let constraints: string;
    if (!this.constraints.length) constraints = "(&)";
    else if (this.constraints.length == 1) constraints = this.constraints[0];
    else constraints = `(&${this.constraints.join("\n\t")})`;
    const properties = {};
    this.properties.forEach((prop) => (properties[prop.key] = prop.value));
    return { constraints, properties };
  }
}
