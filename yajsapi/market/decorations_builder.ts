import { MarketProperty } from "ya-ts-client/dist/ya-payment/src/models/market-property";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models/market-decoration";

export enum ComparisonMethod {
  Eq = "=",
  Lt = "<",
  Gt = ">",
  GtEq = ">=",
  LtEq = "<=",
}

type Constraint = {
  key: string;
  value: string | number;
  comparisonMethod: ComparisonMethod;
};

export class DecorationsBuilder {
  private properties: Array<MarketProperty> = [];
  private constraints: Array<Constraint> = [];

  addProperty(key: string, value: string) {
    const findIndex = this.properties.findIndex((prop) => prop.key === key);
    if (findIndex >= 0) {
      this.properties[findIndex] = { key, value };
    } else {
      this.properties.push({ key, value });
    }
  }
  addConstraint(key: string, value: string | number, comparisonMethod = ComparisonMethod.Eq) {
    this.constraints.push({ key, value, comparisonMethod });
  }
  getDecorations() {
    return {
      properties: this.properties,
      constraints: this.constraints.map((c) => c.key + c.comparisonMethod + c.value),
    };
  }
  private parseConstraint(constraint): Constraint {
    for (const key in ComparisonMethod) {
      const value = ComparisonMethod[key];
      const parsedConstraint = constraint.split(value);
      if (parsedConstraint.length === 2) {
        return {
          key: parsedConstraint[0],
          value: parsedConstraint[1],
          comparisonMethod: ComparisonMethod[key],
        };
      }
    }
    throw new Error(`Unable to parse constraint "${constraint}"`);
  }
  addDecorations(decorations: MarketDecoration) {
    if (decorations.properties) {
      decorations.properties.forEach((prop) => {
        this.addProperty(prop.key, prop.value);
      });
    }
    if (decorations.constraints) {
      decorations.constraints.forEach((cons) => {
        const { key, value, comparisonMethod } = { ...this.parseConstraint(cons) };
        this.addConstraint(key, value, comparisonMethod);
      });
    }
  }
}
