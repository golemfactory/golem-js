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
export type DemandProperty = {
    key: string;
    value: DemandPropertyValue;
};
/**
 * Data structure that represents details of the body for a demand subscription request
 *
 * This type belongs to our domain (use case layer), and will later be "serialized" to the body that's sent to
 * Yagna. You should consider this as a "draft of the demand", that can be finalized by one of the {@link market/api.IMarketApi}
 * implementations.
 */
export type DemandBodyPrototype = {
    properties: DemandProperty[];
    constraints: string[];
};
export declare enum ComparisonOperator {
    Eq = "=",
    Lt = "<",
    Gt = ">",
    GtEq = ">=",
    LtEq = "<="
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
export declare class DemandBodyBuilder {
    private properties;
    private constraints;
    addProperty(key: string, value: DemandPropertyValue): this;
    addConstraint(key: string, value: string | number, comparisonOperator?: ComparisonOperator): this;
    getProduct(): DemandBodyPrototype;
    mergePrototype(prototype: DemandBodyPrototype): this;
    private parseConstraint;
}
