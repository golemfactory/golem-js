import { ComparisonOperator, DemandBodyBuilder } from "../../src/market/demand/demand-body-builder";
import { GolemInternalError } from "../../src/shared/error/golem-error";

describe("#DecorationsBuilder()", () => {
  describe("addProperty()", () => {
    it("should allow to add property", () => {
      const builder = new DemandBodyBuilder();
      builder.addProperty("key", "value");
      expect(builder.getProduct().properties.length).toEqual(1);
    });
    it("should replace already existing property", () => {
      const builder = new DemandBodyBuilder();
      builder.addProperty("key", "value").addProperty("key", "value2");
      expect(builder.getProduct().properties.length).toEqual(1);
      expect(builder.getProduct().properties[0].value).toEqual("value2");
    });
    it("should provide fluent API", () => {
      const builder = new DemandBodyBuilder();
      const flAPI = builder.addProperty("key", "value");
      expect(flAPI).toBeInstanceOf(DemandBodyBuilder);
    });
  });
  describe("addConstraint()", () => {
    it("should allow to add constrain", () => {
      const builder = new DemandBodyBuilder();
      builder.addConstraint("key", "value");
      expect(builder.getProduct().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with >=", () => {
      const builder = new DemandBodyBuilder();
      builder.addConstraint("key", "value", ComparisonOperator.GtEq);
      expect(builder.getProduct().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with <=", () => {
      const builder = new DemandBodyBuilder();
      builder.addConstraint("key", "value", ComparisonOperator.LtEq);
      expect(builder.getProduct().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with >", () => {
      const builder = new DemandBodyBuilder();
      builder.addConstraint("key", "value", ComparisonOperator.Gt);
      expect(builder.getProduct().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with <", () => {
      const builder = new DemandBodyBuilder();
      builder.addConstraint("key", "value", ComparisonOperator.Lt);
      expect(builder.getProduct().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with =", () => {
      const builder = new DemandBodyBuilder();
      builder.addConstraint("key", "value", ComparisonOperator.Eq);
      expect(builder.getProduct().constraints.length).toEqual(1);
    });
    it("should provide fluent API", () => {
      const builder = new DemandBodyBuilder();
      const flAPI = builder.addConstraint("key", "value");
      expect(flAPI).toBeInstanceOf(DemandBodyBuilder);
    });
  });
  describe("addDecorations()", () => {
    it("should allow to parse constrain with =, >=, <=, >, <", async () => {
      const decoration = {
        constraints: [
          "some_constraint=some_value",
          "some_constraint>=some_value",
          "some_constraint<=some_value",
          "some_constraint>some_value",
          "some_constraint<some_value",
        ],
        properties: [],
      };
      const builder = new DemandBodyBuilder();
      builder.mergePrototype(decoration);
      expect(builder.getProduct().constraints.length).toEqual(5);
    });

    it("should allow to add decorations", () => {
      const decoration = {
        properties: [{ key: "prop_key", value: "value" }],
        constraints: ["some_constraint=some_value"],
      };
      const builder = new DemandBodyBuilder();
      builder.mergePrototype(decoration);
      expect(builder.getProduct().constraints.length).toEqual(1);
      expect(builder.getProduct().properties.length).toEqual(1);
    });
    it("should provide fluent API", () => {
      const decoration = {
        properties: [{ key: "prop_key", value: "value" }],
        constraints: ["some_constraint=some_value"],
      };
      const builder = new DemandBodyBuilder();
      const flAPI = builder.mergePrototype(decoration);
      expect(flAPI).toBeInstanceOf(DemandBodyBuilder);
    });

    it("should not allow to add invalid decorations", () => {
      const decoration = {
        properties: [{ key: "prop_key", value: "value" }],
        constraints: ["some_invalid_constraint"],
      };
      const builder = new DemandBodyBuilder();
      expect(() => builder.mergePrototype(decoration)).toThrow(
        new GolemInternalError('Unable to parse constraint "some_invalid_constraint"'),
      );
    });
  });
  describe("getDecorations()", () => {
    it("should return correct decoration", () => {
      const builder = new DemandBodyBuilder();
      builder
        .addConstraint("key", "value", ComparisonOperator.Eq)
        .addConstraint("key", "value", ComparisonOperator.GtEq)
        .addConstraint("key", "value", ComparisonOperator.LtEq)
        .addConstraint("key", "value", ComparisonOperator.Gt)
        .addConstraint("key", "value", ComparisonOperator.Lt)
        .addProperty("key", "value")
        .addProperty("key2", "value");

      expect(builder.getProduct().constraints.length).toEqual(5);
      expect(builder.getProduct().properties.length).toEqual(2);

      expect(builder.getProduct().constraints).toEqual([
        "(key=value)",
        "(key>=value)",
        "(key<=value)",
        "(key>value)",
        "(key<value)",
      ]);

      expect(builder.getProduct().properties).toEqual([
        { key: "key", value: "value" },
        { key: "key2", value: "value" },
      ]);
    });
  });
});
