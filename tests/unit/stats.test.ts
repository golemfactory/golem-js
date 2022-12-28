import { Tasks, TaskStatusEnum } from "../../yajsapi/stats/tasks";
import { expect } from "chai";
import { AbstractAggregator } from "../../yajsapi/stats/abstract_aggregator";

export interface DummyInfo {
  id: string;
  parentId: string;
}

interface Payload {
  id: string;
  parentId: string;
}

export class Dummy extends AbstractAggregator<Payload, DummyInfo> {
  beforeAdd(payload): DummyInfo {
    return payload;
  }
  getByParentId(parentId: string) {
    return this.getByField("parentId", parentId);
  }
  getByNotExistingKey() {
    return this.getByField("key_doesnt_exists", 0);
  }
}

describe("Stats Module", () => {
  describe("Abstract Aggregator", () => {
    it("should add() add items", async () => {
      const tests = new Dummy();
      tests.add({ id: "id", parentId: "parentId" });
      expect(tests.getAll().length).to.equal(1);
    });
    it("should getById() return ItemInfo", async () => {
      const tests = new Dummy();
      tests.add({ id: "id", parentId: "parentId" });
      expect(tests.getById("id")).to.deep.equal({ id: "id", parentId: "parentId" });
    });
    it("should getAll() return array of ItemInfo", async () => {
      const tests = new Dummy();
      tests.add({ id: "id", parentId: "parentId" });
      tests.add({ id: "id2", parentId: "parentId" });
      expect(tests.getAll()).to.be.an("array");
      expect(tests.getAll().length).to.equal(2);
    });
    it("should getByField() return filtered array of ItemInfo", async () => {
      const tests = new Dummy();
      tests.add({ id: "id", parentId: "parentId" });
      tests.add({ id: "id2", parentId: "parentId2" });
      tests.add({ id: "id3", parentId: "parentId3" });
      expect(tests.getByParentId("parentId2")).to.be.an("array");
      expect(tests.getByParentId("parentId2").length).to.equal(1);
    });

    it("should getByField() return empty array if there is no existing key", async () => {
      const tests = new Dummy();
      tests.add({ id: "id", parentId: "parentId" });
      tests.add({ id: "id2", parentId: "parentId2" });
      tests.add({ id: "id3", parentId: "parentId3" });
      expect(tests.getByNotExistingKey()).to.be.an("array");
      expect(tests.getByNotExistingKey().length).to.equal(0);
    });
  });
});
