import { GolemInternalError } from "../../shared/error/golem-error";

/**
 * Defines what kind of value data types one can expect in the raw Demand Properties
 */
export type DemandPropertyValue = string | number | boolean | string[] | number[];

/**
 * Represents a single property/attribute that can be set on a Demand to specify Requestor needs
 *
 * Demand properties should be understood as values for various parameters of the agreement between Provider and Requestor.
 * By defining properties on the demand, and negotiating them, the parties settle on the Terms & Conditions of the collaboration.
 */
export type DemandProperty = { key: string; value: DemandPropertyValue };

/**
 * Represents requirements that the offer from the Provider has to meet, so that it's going to be matched by Yagna with the Demand
 */
type DemandConstraint = {
  key: string;
  value: string | number;
  comparisonOperator: ComparisonOperator;
};

/**
 * Data structure that represents details of the body for a demand subscription request
 *
 * This type belongs to our domain (use case layer), and will later be "serialized" to the body that's sent to
 * Yagna. You should consider this as a "draft of the demand", that can be finalized by one of the {@link MarketApi}
 * implementations.
 */
export type DemandBodyPrototype = {
  properties: DemandProperty[];
  constraints: string[];
};

export enum ComparisonOperator {
  Eq = "=",
  Lt = "<",
  Gt = ">",
  GtEq = ">=",
  LtEq = "<=",
}

/**
 * A helper class assisting in building the Golem Demand object
 *
 * Various directors should use the builder to add properties and constraints before the final product is received
 * from the builder and sent to yagna to subscribe for matched offers (proposals).
 *
 * The main purpose of the builder is to accept different requirements (properties and constraints) from different
 * directors who know what kind of properties and constraints are needed. Then it helps to merge these requirements.
 *
 * Demand -> DemandSpecification -> DemandPrototype -> DemandDTO
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

  getProduct(): DemandBodyPrototype {
    return {
      properties: this.properties,
      constraints: this.constraints.map((c) => `(${c.key + c.comparisonOperator + c.value})`),
    };
  }

  mergePrototype(prototype: DemandBodyPrototype) {
    if (prototype.properties) {
      prototype.properties.forEach((prop) => {
        this.addProperty(prop.key, prop.value);
      });
    }

    if (prototype.constraints) {
      prototype.constraints.forEach((cons) => {
        const { key, value, comparisonOperator } = { ...this.parseConstraint(cons) };
        this.addConstraint(key, value, comparisonOperator);
      });
    }

    return this;
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
