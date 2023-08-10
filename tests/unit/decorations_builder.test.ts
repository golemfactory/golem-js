import { ComparisonOperator, DecorationsBuilder } from "../../src/market/builder";

describe("#DecorationsBuilder()", () => {
  describe("addProperty()", () => {
    it("should allow to add property", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addProperty("key", "value");
      expect(decorationsBuilder.getDecorations().properties.length).toEqual(1);
    });
    it("should replace already existing property", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addProperty("key", "value").addProperty("key", "value2");
      expect(decorationsBuilder.getDecorations().properties.length).toEqual(1);
      expect(decorationsBuilder.getDecorations().properties[0].value).toEqual("value2");
    });
    it("should provide fluent API", () => {
      const decorationsBuilder = new DecorationsBuilder();
      const flAPI = decorationsBuilder.addProperty("key", "value");
      expect(flAPI).toBeInstanceOf(DecorationsBuilder);
    });
  });
  describe("addConstraint()", () => {
    it("should allow to add constrain", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value");
      expect(decorationsBuilder.getDecorations().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with >=", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonOperator.GtEq);
      expect(decorationsBuilder.getDecorations().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with <=", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonOperator.LtEq);
      expect(decorationsBuilder.getDecorations().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with >", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonOperator.Gt);
      expect(decorationsBuilder.getDecorations().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with <", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonOperator.Lt);
      expect(decorationsBuilder.getDecorations().constraints.length).toEqual(1);
    });
    it("should allow to add constrain with =", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonOperator.Eq);
      expect(decorationsBuilder.getDecorations().constraints.length).toEqual(1);
    });
    it("should provide fluent API", () => {
      const decorationsBuilder = new DecorationsBuilder();
      const flAPI = decorationsBuilder.addConstraint("key", "value");
      expect(flAPI).toBeInstanceOf(DecorationsBuilder);
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
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addDecoration(decoration);
      expect(decorationsBuilder.getDecorations().constraints.length).toEqual(5);
    });

    it("should allow to add decorations", () => {
      const decoration = {
        properties: [{ key: "prop_key", value: "value" }],
        constraints: ["some_constraint=some_value"],
      };
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addDecoration(decoration);
      expect(decorationsBuilder.getDecorations().constraints.length).toEqual(1);
      expect(decorationsBuilder.getDecorations().properties.length).toEqual(1);
    });
    it("should provide fluent API", () => {
      const decoration = {
        properties: [{ key: "prop_key", value: "value" }],
        constraints: ["some_constraint=some_value"],
      };
      const decorationsBuilder = new DecorationsBuilder();
      const flAPI = decorationsBuilder.addDecoration(decoration);
      expect(flAPI).toBeInstanceOf(DecorationsBuilder);
    });
  });
  describe("getDecorations()", () => {
    it("should return correct decoration", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder
        .addConstraint("key", "value", ComparisonOperator.Eq)
        .addConstraint("key", "value", ComparisonOperator.GtEq)
        .addConstraint("key", "value", ComparisonOperator.LtEq)
        .addConstraint("key", "value", ComparisonOperator.Gt)
        .addConstraint("key", "value", ComparisonOperator.Lt)
        .addProperty("key", "value")
        .addProperty("key2", "value");

      expect(decorationsBuilder.getDecorations().constraints.length).toEqual(5);
      expect(decorationsBuilder.getDecorations().properties.length).toEqual(2);

      expect(decorationsBuilder.getDecorations().constraints).toEqual([
        "(key=value)",
        "(key>=value)",
        "(key<=value)",
        "(key>value)",
        "(key<value)",
      ]);

      expect(decorationsBuilder.getDecorations().properties).toEqual([
        { key: "key", value: "value" },
        { key: "key2", value: "value" },
      ]);
    });
  });
});
