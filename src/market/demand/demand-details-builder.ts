import { MarketApi } from "ya-ts-client";
import { GolemInternalError } from "../../shared/error/golem-error";
import { DemandDetails } from "../demand";

/**
 * Defines what kind of value data types one can expect in the raw Demand Properties
 */
type DemandPropertyValue = string | number | boolean | string[] | number[];

/**
 * Represents a single property/attribute that can be set on a Demand to specify Requestor needs
 *
 * Demand properties should be understood as values for various parameters of the agreement between Provider and Requestor.
 * By defining properties on the demand, and negotiating them, the parties settle on the Terms & Conditions of the collaboration.
 */
type DemandProperty = { key: string; value: DemandPropertyValue };

/**
 * Represents requirements that the offer from the Provider has to meet, so that it's going to be matched by Yagna with the Demand
 */
type DemandConstraint = {
  key: string;
  value: string | number;
  comparisonOperator: ComparisonOperator;
};

/**
 * Represent a set of properties and constraints to be added to a market object (i.e. a demand or an offer).
 */
type DemandBodyPrototype = {
  properties: Array<DemandProperty>;
  constraints: Array<string>;
};

export enum ComparisonOperator {
  Eq = "=",
  Lt = "<",
  Gt = ">",
  GtEq = ">=",
  LtEq = "<=",
}

/**
 * A helper class for creating market decorations for `Demand` published on the market.
 *
 * Various directors should use the builder to add properties and constraints before the final product is received
 * from the builder and sent to yagna to subscribe for matched offers (proposals).
 *
 * The main purpose of the builder is to accept different requirements (properties and constraints) from different
 * directors who know what kind of properties and constraints are needed. Then it helps to merge these requirements.
 */
export class DemandDetailsBuilder {
  private properties: Array<DemandProperty> = [];
  private constraints: Array<DemandConstraint> = [];

  addProperty(key: string, value: DemandPropertyValue) {
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

  getDemandBodyPrototype(): DemandBodyPrototype {
    return {
      properties: this.properties,
      constraints: this.constraints.map((c) => `(${c.key + c.comparisonOperator + c.value})`),
    };
  }

  getProduct(paymentPlatform: string, expirationSec: number): DemandDetails {
    const body = this.buildDemandRequestBody();
    return new DemandDetails(body, paymentPlatform, expirationSec);
  }

  addDecoration(decoration: DemandBodyPrototype) {
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

  private buildDemandRequestBody(): MarketApi.DemandOfferBaseDTO {
    const decorations = this.getDemandBodyPrototype();
    let constraints: string;

    if (!decorations.constraints.length) constraints = "(&)";
    else if (decorations.constraints.length == 1) constraints = decorations.constraints[0];
    else constraints = `(&${decorations.constraints.join("\n\t")})`;

    const properties: Record<string, DemandPropertyValue> = {};
    decorations.properties.forEach((prop) => (properties[prop.key] = prop.value));

    return { constraints, properties };
  }

  private parseConstraint(constraint: string): DemandConstraint {
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
}
