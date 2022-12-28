import { expect } from "chai";
import { AbstractAggregator } from "../../yajsapi/stats/abstract_aggregator";
import { Activities } from "../../yajsapi/stats/activities";
import { Agreements, AgreementStatusEnum } from "../../yajsapi/stats/agreements";
import { Allocations } from "../../yajsapi/stats/allocations";
import { Invoices } from "../../yajsapi/stats/invoices";
import { Payments } from "../../yajsapi/stats/payments";
import { Proposals } from "../../yajsapi/stats/proposals";
import { Providers } from "../../yajsapi/stats/providers";
import { Tasks, TaskStatusEnum } from "../../yajsapi/stats/tasks";
import { Collection } from "collect.js";

describe("Stats Module", () => {
  describe("Abstract Aggregator", () => {
    it("should add() add items", async () => {
      const tests = new Dummy();
      tests.add({ id: "id", parentId: "parentId" });
      expect(tests.getAll().count()).to.equal(1);
    });
    it("should getById() return ItemInfo", async () => {
      const tests = new Dummy();
      tests.add({ id: "id", parentId: "parentId" });
      expect(tests.getById("id")).to.deep.equal({ id: "id", parentId: "parentId" });
    });
    it("should getAll() return Collection of ItemInfo", async () => {
      const tests = new Dummy();
      tests.add({ id: "id", parentId: "parentId" });
      tests.add({ id: "id2", parentId: "parentId" });
      expect(tests.getAll()).to.be.instanceof(Collection);
      expect(tests.getAll().count()).to.equal(2);
    });
    it("should getByField() return filtered Collection of ItemInfo", async () => {
      const tests = new Dummy();
      tests.add({ id: "id", parentId: "parentId" });
      tests.add({ id: "id2", parentId: "parentId2" });
      tests.add({ id: "id3", parentId: "parentId3" });
      expect(tests.getByParentId("parentId2")).to.be.instanceof(Collection);
      expect(tests.getByParentId("parentId2").count()).to.equal(1);
    });

    it("should getByField() return empty Collection if there is no existing key", async () => {
      const tests = new Dummy();
      tests.add({ id: "id", parentId: "parentId" });
      tests.add({ id: "id2", parentId: "parentId2" });
      tests.add({ id: "id3", parentId: "parentId3" });
      expect(tests.getByNotExistingKey()).to.be.instanceof(Collection);
      expect(tests.getByNotExistingKey().count()).to.equal(0);
    });
  });
  describe("Activities", () => {
    it("should beforeAdd() converts payload to ActivityInfo", async () => {
      const tests = new Activities();
      tests.add({ id: "id", taskId: "taskId", agreementId: "agreementId" });
      expect(tests.getAll()).to.deep.equal(
        new Collection([{ id: "id", taskId: "taskId", agreementId: "agreementId" }])
      );
    });
    it("should getByAgreementId() return Collection of ActivityInfo", async () => {
      const tests = new Activities();
      tests.add({ id: "id", taskId: "taskId", agreementId: "agreementId" });
      tests.add({ id: "id2", taskId: "taskId2", agreementId: "agreementId2" });
      tests.add({ id: "id3", taskId: "taskId3", agreementId: "agreementId3" });
      expect(tests.getByAgreementId("agreementId").count()).to.equal(1);
    });
    it("should getByTaskId() return Collection of ActivityInfo", async () => {
      const tests = new Activities();
      tests.add({ id: "id", taskId: "taskId", agreementId: "agreementId" });
      tests.add({ id: "id2", taskId: "taskId2", agreementId: "agreementId2" });
      tests.add({ id: "id3", taskId: "taskId3", agreementId: "agreementId3" });
      expect(tests.getByTaskId("taskId").count()).to.equal(1);
    });
  });
  describe("Agreements", () => {
    it("should beforeAdd() converts payload to AgreementInfo", async () => {
      const tests = new Agreements();
      tests.add({ id: "id", providerId: "providerId" });
      expect(tests.getAll()).to.deep.equal(
        new Collection([{ id: "id", providerId: "providerId", status: AgreementStatusEnum.Pending }])
      );
    });
    it("should confirm() flag AgreementInfo.status as confirmed ", async () => {
      const tests = new Agreements();
      tests.add({ id: "id", providerId: "providerId" });
      tests.confirm("id");
      expect(tests.getAll()).to.deep.equal(
        new Collection([
          {
            id: "id",
            providerId: "providerId",
            status: AgreementStatusEnum.Confirmed,
          },
        ])
      );
    });
    it("should reject() flag AgreementInfo.status as rejected ", async () => {
      const tests = new Agreements();
      tests.add({ id: "id", providerId: "providerId" });
      tests.reject("id");
      expect(tests.getAll()).to.deep.equal(
        new Collection([{ id: "id", providerId: "providerId", status: AgreementStatusEnum.Rejected }])
      );
    });
    it("should getByProviderId() return filtered Collection of AgreementInfo", async () => {
      const tests = new Agreements();
      tests.add({ id: "id", providerId: "providerId" });
      tests.add({ id: "id2", providerId: "providerId2" });
      tests.add({ id: "id3", providerId: "providerId" });
      expect(tests.getByProviderId("providerId").count()).to.equal(2);
    });
    it("should getByStatus() return filtered Collection of AgreementInfo", async () => {
      const tests = new Agreements();
      tests.add({ id: "id", providerId: "providerId" });
      tests.reject("id");
      tests.add({ id: "id2", providerId: "providerId2" });
      tests.confirm("id2");
      tests.add({ id: "id3", providerId: "providerId" });
      expect(tests.getByStatus(AgreementStatusEnum.Rejected).count()).to.equal(1);
      expect(tests.getByStatus(AgreementStatusEnum.Confirmed).count()).to.equal(1);
      expect(tests.getByStatus(AgreementStatusEnum.Pending).count()).to.equal(1);
    });
  });
  describe("Allocations", () => {
    it("should beforeAdd() converts payload to AllocationInfo", async () => {
      const tests = new Allocations();
      tests.add({ id: "id", amount: 100, platform: "platform" });
      expect(tests.getAll()).to.deep.equal(new Collection([{ id: "id", amount: 100, platform: "platform" }]));
    });
  });
  describe("Invoices", () => {
    it("should beforeAdd() converts payload to InvoiceInfo", async () => {
      const tests = new Invoices();
      tests.add({ id: "id", amount: "100", providerId: "providerId", agreementId: "agreementId" });
      expect(tests.getAll()).to.deep.equal(
        new Collection([
          {
            id: "id",
            amount: 100,
            providerId: "providerId",
            agreementId: "agreementId",
          },
        ])
      );
    });
    it("should getByProviderId() return filtered Collection of InvoiceInfo", async () => {
      const tests = new Invoices();
      tests.add({ id: "id", amount: "100", providerId: "providerId", agreementId: "agreementId" });
      tests.add({ id: "id2", amount: "100", providerId: "providerId2", agreementId: "agreementId2" });
      tests.add({ id: "id3", amount: "100", providerId: "providerId", agreementId: "agreementId3" });
      expect(tests.getByProviderId("providerId").count()).to.equal(2);
    });
    it("should getByAgreementId() return filtered Collection of InvoiceInfo", async () => {
      const tests = new Invoices();
      tests.add({ id: "id", amount: "100", providerId: "providerId", agreementId: "agreementId" });
      tests.add({ id: "id2", amount: "100", providerId: "providerId2", agreementId: "agreementId2" });
      tests.add({ id: "id3", amount: "100", providerId: "providerId3", agreementId: "agreementId" });
      expect(tests.getByAgreementId("agreementId").count()).to.equal(2);
    });
  });
  describe("Payments", () => {
    it("should beforeAdd() converts payload to PaymentInfo", async () => {
      const tests = new Payments();
      tests.add({ id: "id", amount: "100", providerId: "providerId", agreementId: "agreementId" });
      expect(tests.getAll()).to.deep.equal(
        new Collection([
          {
            id: "id",
            amount: 100,
            providerId: "providerId",
            agreementId: "agreementId",
          },
        ])
      );
    });
    it("should getByProviderId() return filtered Collection of PaymentInfo", async () => {
      const tests = new Payments();
      tests.add({ id: "id", amount: "100", providerId: "providerId", agreementId: "agreementId" });
      tests.add({ id: "id2", amount: "100", providerId: "providerId2", agreementId: "agreementId2" });
      tests.add({ id: "id3", amount: "100", providerId: "providerId", agreementId: "agreementId3" });
      expect(tests.getByProviderId("providerId").count()).to.equal(2);
    });
    it("should getByAgreementId() return filtered Collection of PaymentInfo", async () => {
      const tests = new Payments();
      tests.add({ id: "id", amount: "100", providerId: "providerId", agreementId: "agreementId" });
      tests.add({ id: "id2", amount: "100", providerId: "providerId2", agreementId: "agreementId2" });
      tests.add({ id: "id3", amount: "100", providerId: "providerId3", agreementId: "agreementId" });
      expect(tests.getByAgreementId("agreementId").count()).to.equal(2);
    });
  });
  describe("Proposals", () => {
    it("should beforeAdd() converts payload to ProposalInfo", async () => {
      const tests = new Proposals();
      tests.add({ id: "id", providerId: "providerId" });
      expect(tests.getAll()).to.deep.equal(
        new Collection([
          {
            id: "id",
            providerId: "providerId",
          },
        ])
      );
    });

    it("should getByProviderId() return filtered Collection of ProposalInfo", async () => {
      const tests = new Proposals();
      tests.add({ id: "id", providerId: "providerId" });
      tests.add({ id: "id2", providerId: "providerId2" });
      tests.add({ id: "id3", providerId: "providerId" });
      expect(tests.getByProviderId("providerId")).to.be.instanceof(Collection);
      expect(tests.getByProviderId("providerId").count()).to.equal(2);
    });
  });
  describe("Providers", () => {
    it("should beforeAdd() converts payload to ProviderInfo", async () => {
      const tests = new Providers();
      tests.add({ id: "id", providerName: "providerName" });
      expect(tests.getAll()).to.deep.equal(
        new Collection([
          {
            id: "id",
            providerName: "providerName",
          },
        ])
      );
    });
  });
  describe("Tasks", () => {
    it("should beforeAdd() converts payload to TaskInfo", async () => {
      const tests = new Tasks();
      tests.add({ id: "id", startTime: 100 });
      expect(tests.getAll()).to.deep.equal(
        new Collection([
          {
            id: "id",
            startTime: 100,
            stopTime: 0,
            retriesCount: 0,
            status: TaskStatusEnum.Pending,
          },
        ])
      );
    });
    it("should retry() should setup TaskInfo.retriesCount", async () => {
      const tests = new Tasks();
      tests.add({ id: "id", startTime: 100 });
      tests.retry("id", 1);
      expect(tests.getAll()).to.deep.equal(
        new Collection([
          {
            id: "id",
            startTime: 100,
            stopTime: 0,
            retriesCount: 1,
            status: TaskStatusEnum.Pending,
          },
        ])
      );
    });
    it("should reject() should setup TaskInfo.status as Rejected, stopTime and reason", async () => {
      const tests = new Tasks();
      tests.add({ id: "id", startTime: 100 });
      tests.reject("id", 200, "reason");
      expect(tests.getAll()).to.deep.equal(
        new Collection([
          {
            id: "id",
            startTime: 100,
            stopTime: 200,
            retriesCount: 0,
            status: TaskStatusEnum.Rejected,
            reason: "reason",
          },
        ])
      );
    });
    it("should finish() should setup TaskInfo.status as Finished, and stopTime", async () => {
      const tests = new Tasks();
      tests.add({ id: "id", startTime: 100 });
      tests.finish("id", 200);
      expect(tests.getAll()).to.deep.equal(
        new Collection([
          {
            id: "id",
            startTime: 100,
            stopTime: 200,
            retriesCount: 0,
            status: TaskStatusEnum.Finished,
          },
        ])
      );
    });
  });
});

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
