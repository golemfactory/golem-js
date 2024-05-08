import { ComparisonOperator, DemandDetailsBuilder } from "../../src/market/demand/demand-details-builder";
import { GolemInternalError } from "../../src/shared/error/golem-error";

describe("#DecorationsBuilder()", () => {
  describe("addProperty()", () => {
    it("should allow to add property", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder.addProperty("key", "value");
      expect(decorationsBuilder.getDemandBodyPrototype().properties.length).toEqual(1);
    });
    it("should replace already existing property", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder.addProperty("key", "value").addProperty("key", "value2");
      expect(decorationsBuilder.getDemandBodyPrototype().properties.length).toEqual(1);
      expect(decorationsBuilder.getDemandBodyPrototype().properties[0].value).toEqual("value2");
    });
    it("should provide fluent API", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      const flAPI = decorationsBuilder.addProperty("key", "value");
      expect(flAPI).toBeInstanceOf(DemandDetailsBuilder);
    });
  });
  describe("addConstraint()", () => {
    it("should allow to add constrain", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder.addConstraint("key", "value");
      expect(decorationsBuilder.getDemandBodyPrototype().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with >=", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonOperator.GtEq);
      expect(decorationsBuilder.getDemandBodyPrototype().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with <=", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonOperator.LtEq);
      expect(decorationsBuilder.getDemandBodyPrototype().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with >", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonOperator.Gt);
      expect(decorationsBuilder.getDemandBodyPrototype().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with <", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonOperator.Lt);
      expect(decorationsBuilder.getDemandBodyPrototype().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with =", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonOperator.Eq);
      expect(decorationsBuilder.getDemandBodyPrototype().constraints.length).toEqual(1);
    });
    it("should provide fluent API", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      const flAPI = decorationsBuilder.addConstraint("key", "value");
      expect(flAPI).toBeInstanceOf(DemandDetailsBuilder);
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
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder.addDecoration(decoration);
      expect(decorationsBuilder.getDemandBodyPrototype().constraints.length).toEqual(5);
    });

    it("should allow to add decorations", () => {
      const decoration = {
        properties: [{ key: "prop_key", value: "value" }],
        constraints: ["some_constraint=some_value"],
      };
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder.addDecoration(decoration);
      expect(decorationsBuilder.getDemandBodyPrototype().constraints.length).toEqual(1);
      expect(decorationsBuilder.getDemandBodyPrototype().properties.length).toEqual(1);
    });
    it("should provide fluent API", () => {
      const decoration = {
        properties: [{ key: "prop_key", value: "value" }],
        constraints: ["some_constraint=some_value"],
      };
      const decorationsBuilder = new DemandDetailsBuilder();
      const flAPI = decorationsBuilder.addDecoration(decoration);
      expect(flAPI).toBeInstanceOf(DemandDetailsBuilder);
    });

    it("should not allow to add invalid decorations", () => {
      const decoration = {
        properties: [{ key: "prop_key", value: "value" }],
        constraints: ["some_invalid_constraint"],
      };
      const decorationsBuilder = new DemandDetailsBuilder();
      expect(() => decorationsBuilder.addDecoration(decoration)).toThrow(
        new GolemInternalError('Unable to parse constraint "some_invalid_constraint"'),
      );
    });
  });
  describe("getDecorations()", () => {
    it("should return correct decoration", () => {
      const decorationsBuilder = new DemandDetailsBuilder();
      decorationsBuilder
        .addConstraint("key", "value", ComparisonOperator.Eq)
        .addConstraint("key", "value", ComparisonOperator.GtEq)
        .addConstraint("key", "value", ComparisonOperator.LtEq)
        .addConstraint("key", "value", ComparisonOperator.Gt)
        .addConstraint("key", "value", ComparisonOperator.Lt)
        .addProperty("key", "value")
        .addProperty("key2", "value");

      expect(decorationsBuilder.getDemandBodyPrototype().constraints.length).toEqual(5);
      expect(decorationsBuilder.getDemandBodyPrototype().properties.length).toEqual(2);

      expect(decorationsBuilder.getDemandBodyPrototype().constraints).toEqual([
        "(key=value)",
        "(key>=value)",
        "(key<=value)",
        "(key>value)",
        "(key<value)",
      ]);

      expect(decorationsBuilder.getDemandBodyPrototype().properties).toEqual([
        { key: "key", value: "value" },
        { key: "key2", value: "value" },
      ]);
    });
  });
});
