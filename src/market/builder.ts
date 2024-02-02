import { MarketProperty } from "ya-ts-client/dist/ya-payment/src/models";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market/src/models";
import { GolemInternalError } from "../error/golem-error";

/**
 * Properties and constraints to be added to a market object (i.e. a demand or an offer).
 */
export type MarketDecoration = {
  properties: Array<{ key: string; value: string | number | boolean }>;
  constraints: Array<string>;
};

/**
 * @hidden
 */
export enum ComparisonOperator {
  Eq = "=",
  Lt = "<",
  Gt = ">",
  GtEq = ">=",
  LtEq = "<=",
}

type Constraint = {
  key: string;
  value: string | number;
  comparisonOperator: ComparisonOperator;
};

/**
 * A helper class for creating market decorations for `Demand` published on the market.
 * @hidden
 */
export class DecorationsBuilder {
  private properties: Array<MarketProperty | { key: string; value: string | number | boolean }> = [];
  private constraints: Array<Constraint> = [];

  addProperty(key: string, value: string | number | boolean) {
    const findIndex = this.properties.findIndex((prop) => prop.key === key);
    if (findIndex >= 0) {
      this.properties[findIndex] = { key, value };
    } else {
      this.properties.push({ key, value });
    }
    return this;
  }
  addConstraint(key: string, value: string | number, comparisonOperator = ComparisonOperator.Eq) {
    this.constraints.push({ key, value, comparisonOperator });
    return this;
  }
  getDecorations(): MarketDecoration {
    return {
      properties: this.properties,
      constraints: this.constraints.map((c) => `(${c.key + c.comparisonOperator + c.value})`),
    };
  }
  getDemandRequest(): DemandOfferBase {
    const decorations = this.getDecorations();
    let constraints: string;
    if (!decorations.constraints.length) constraints = "(&)";
    else if (decorations.constraints.length == 1) constraints = decorations.constraints[0];
    else constraints = `(&${decorations.constraints.join("\n\t")})`;
    const properties: Record<string, string | number | boolean> = {};
    decorations.properties.forEach((prop) => (properties[prop.key] = prop.value));
    return { constraints, properties };
  }
  private parseConstraint(constraint: string): Constraint {
    for (const key in ComparisonOperator) {
      const value = ComparisonOperator[key as keyof typeof ComparisonOperator];
      const parsedConstraint = constraint.slice(1, -1).split(value);
      if (parsedConstraint.length === 2) {
        return {
          key: parsedConstraint[0],
          value: parsedConstraint[1],
          comparisonOperator: value,
        };
      }
    }
    throw new GolemInternalError(`Unable to parse constraint "${constraint}"`);
  }
  addDecoration(decoration: MarketDecoration) {
    if (decoration.properties) {
      decoration.properties.forEach((prop) => {
        this.addProperty(prop.key, prop.value);
      });
    }
    if (decoration.constraints) {
      decoration.constraints.forEach((cons) => {
        const { key, value, comparisonOperator } = { ...this.parseConstraint(cons) };
        this.addConstraint(key, value, comparisonOperator);
      });
    }
    return this;
  }
  addDecorations(decorations: MarketDecoration[]) {
    decorations.forEach((d) => this.addDecoration(d));
    return this;
  }
}
