import { expect } from "chai";
import { ComparisonMethod, DecorationsBuilder } from "../../yajsapi/market/decorations_builder";

describe("#DecorationsBuilder()", () => {
  before(() => {
    //
  });
  describe("addProperty()", () => {
    it("should allow to add property", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addProperty("key", "value");
      expect(decorationsBuilder.getDecorations().properties.length).to.equal(1);
    });
    it("should replace already existing property", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addProperty("key", "value");
      decorationsBuilder.addProperty("key", "value2");
      expect(decorationsBuilder.getDecorations().properties.length).to.equal(1);
      expect(decorationsBuilder.getDecorations().properties[0].value).to.equal("value2");
    });
  });
  describe("addConstraint()", () => {
    it("should allow to add constrain", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value");
      expect(decorationsBuilder.getDecorations().constraints.length).to.equal(1);
    });
    it("should allow to add constrain with >=", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonMethod.GtEq);
      expect(decorationsBuilder.getDecorations().constraints.length).to.equal(1);
    });
    it("should allow to add constrain with <=", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonMethod.LtEq);
      expect(decorationsBuilder.getDecorations().constraints.length).to.equal(1);
    });
    it("should allow to add constrain with >", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonMethod.Gt);
      expect(decorationsBuilder.getDecorations().constraints.length).to.equal(1);
    });
    it("should allow to add constrain with <", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonMethod.Lt);
      expect(decorationsBuilder.getDecorations().constraints.length).to.equal(1);
    });
    it("should allow to add constrain with =", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonMethod.Eq);
      expect(decorationsBuilder.getDecorations().constraints.length).to.equal(1);
    });
  });
  describe("addDecorations()", () => {
    it("should allow to parse constrain with =, >=, <=, >, <", async () => {
      const decorations = {
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
      decorationsBuilder.addDecorations(decorations);
      expect(decorationsBuilder.getDecorations().constraints.length).to.equal(1);
    });

    it("should allow to add decorations", () => {
      const decorations = {
        properties: [{ key: "prop_key", value: "value" }],
        constraints: ["some_constraint=some_value"],
      };
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addDecorations(decorations);
      expect(decorationsBuilder.getDecorations().constraints.length).to.equal(1);
      expect(decorationsBuilder.getDecorations().properties.length).to.equal(1);
    });
  });
  describe("getDecorations()", () => {
    it("should return correct decoration", () => {
      const decorationsBuilder = new DecorationsBuilder();
      decorationsBuilder.addConstraint("key", "value", ComparisonMethod.Eq);
      decorationsBuilder.addConstraint("key", "value", ComparisonMethod.GtEq);
      decorationsBuilder.addConstraint("key", "value", ComparisonMethod.LtEq);
      decorationsBuilder.addConstraint("key", "value", ComparisonMethod.Gt);
      decorationsBuilder.addConstraint("key", "value", ComparisonMethod.Lt);

      decorationsBuilder.addProperty("key", "value");
      decorationsBuilder.addProperty("key2", "value");

      expect(decorationsBuilder.getDecorations().constraints.length).to.equal(5);
      expect(decorationsBuilder.getDecorations().properties.length).to.equal(2);

      expect(decorationsBuilder.getDecorations().constraints).to.eql([
        "key=value",
        "key>=value",
        "key<=value",
        "key>value",
        "key<value",
      ]);

      expect(decorationsBuilder.getDecorations().properties).to.eql([
        { key: "key", value: "value" },
        { key: "key2", value: "value" },
      ]);
    });
  });
});
