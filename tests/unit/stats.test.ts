import { Tasks } from "../../yajsapi/stats/tasks";
import { expect } from "chai";

describe("Stats Module", () => {
  describe("Tasks", () => {
    it("should addStartTime() set setup startTime", async () => {
      const tests = new Tasks();
      tests.addStartTime(1000);
      expect(tests.startTime).to.equal(1000);
    });
    it("should addStopTime() setup stopTime", async () => {
      const tests = new Tasks();
      tests.addStopTime(1000);
      expect(tests.stopTime).to.equal(1000);
    });
    it("should startTask() add tasks", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      expect(tests.getAllTasks().length).to.equal(1);
    });
    it("should startTask() setup agreementId", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      expect([...tests.getAllTasks()[0].agreements.values()][0]).to.equal("agreementId");
    });
    it("should startTask() setup activityId", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      expect([...tests.getAllTasks()[0].activities.values()][0]).to.equal("activityId");
    });
    it("should startTask() do not add task if task with same id exists", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      tests.startTask("id", "agreementId2", "activityId2", 2000);
      expect(tests.getAllTasks().length).to.equal(1);
    });
    it("should startTask() another agreementId to existing task", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      tests.startTask("id", "agreementId2", "activityId2", 2000);
      expect([...tests.getAllTasks()[0].agreements.values()]).to.contain("agreementId");
      expect([...tests.getAllTasks()[0].agreements.values()]).to.contain("agreementId2");
    });
    it("should startTask() another activityId to existing task", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      tests.startTask("id", "agreementId2", "activityId2", 2000);
      expect([...tests.getAllTasks()[0].activities.values()]).to.contain("activityId");
      expect([...tests.getAllTasks()[0].activities.values()]).to.contain("activityId2");
    });
    it("should stopTask() should setup timestamp", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      tests.stopTask("id", 2000, true);

      expect([...tests.getAllTasks()][0].stopTime).to.eq(2000);
    });
    it("should stopTask() should setup success flag on true", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      tests.stopTask("id", 2000, true);

      expect([...tests.getAllTasks()][0].success).to.eq(true);
    });
    it("should stopTask() should setup success flag on false", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      tests.stopTask("id", 2000, false);

      expect([...tests.getAllTasks()][0].success).to.eq(false);
    });
    it("should stopTask() should setup reason", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      tests.stopTask("id", 2000, false, "reason");

      expect([...tests.getAllTasks()][0].reason).to.eq("reason");
    });
    it("should retryTask() should setup retriesCount", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", 1000);
      tests.retryTask("id", 5);

      expect([...tests.getAllTasks()][0].retriesCount).to.eq(5);
    });
    it("should getComputedTasksAgreementId() should return only successfully completed tasks by given agreementId", async () => {
      const tests = new Tasks();
      tests.startTask("id1", "agreementId", "activityId", 1000);
      tests.startTask("id2", "agreementId2", "activityId", 1000);
      tests.startTask("id3", "agreementId", "activityId", 1000);
      tests.startTask("id4", "agreementId", "activityId", 1000);
      tests.stopTask("id1", 2000, true);
      tests.stopTask("id2", 2000, true);
      tests.stopTask("id3", 2000, false);
      tests.stopTask("id4", 2000, true);

      expect(tests.getComputedTasksCountAgreementId("agreementId")).to.eq(2);
    });
    it("should getComputedTasksAgreementId() should return only successfully completed tasks by given agreementId", async () => {
      const tests = new Tasks();
      tests.startTask("id1", "agreementId", "activityId1", 1000);
      tests.startTask("id2", "agreementId2", "activityId2", 1000);
      tests.startTask("id3", "agreementId", "activityId3", 1000);
      tests.startTask("id4", "agreementId", "activityId4", 1000);
      tests.stopTask("id1", 2000, true);
      tests.stopTask("id2", 2000, true);
      tests.stopTask("id3", 2000, false);
      tests.stopTask("id4", 2000, true);

      expect(tests.getComputedTasksCountAgreementId("agreementId")).to.eq(2);
    });
    it("should getActivitiesByAgreementId() should return activities Ids for given agreementId", async () => {
      const tests = new Tasks();
      tests.startTask("id1", "agreementId", "activityId1", 1000);
      tests.startTask("id2", "agreementId2", "activityId2", 1000);
      tests.startTask("id3", "agreementId", "activityId3", 1000);
      tests.startTask("id4", "agreementId", "activityId4", 1000);

      const activities = tests.getActivitiesByAgreementId("agreementId");
      expect(activities.length).to.eq(3);
      expect(activities).to.contain("activityId1");
      expect(activities).to.contain("activityId3");
      expect(activities).to.contain("activityId4");
    });
    it("should getActivitiesByAgreementId() should return empty array if agreementId is not found", async () => {
      const tests = new Tasks();
      tests.startTask("id1", "agreementId", "activityId1", 1000);
      tests.startTask("id2", "agreementId2", "activityId2", 1000);
      tests.startTask("id3", "agreementId", "activityId3", 1000);
      tests.startTask("id4", "agreementId", "activityId4", 1000);

      const activities = tests.getActivitiesByAgreementId("agreementId3");
      expect(activities.length).to.eq(0);
    });
    it("should getTasksCountByAgreementId() should return number activities for given agreementId", async () => {
      const tests = new Tasks();
      tests.startTask("id1", "agreementId", "activityId1", 1000);
      tests.startTask("id2", "agreementId2", "activityId2", 1000);
      tests.startTask("id3", "agreementId", "activityId3", 1000);
      tests.startTask("id4", "agreementId", "activityId4", 1000);

      expect(tests.getTasksCountByAgreementId("agreementId")).to.eq(3);
    });
    it("should getTasksCountByAgreementId() should return 0 if agreementId is not found", async () => {
      const tests = new Tasks();
      tests.startTask("id1", "agreementId", "activityId1", 1000);
      tests.startTask("id2", "agreementId2", "activityId2", 1000);
      tests.startTask("id3", "agreementId", "activityId3", 1000);
      tests.startTask("id4", "agreementId", "activityId4", 1000);

      expect(tests.getTasksCountByAgreementId("agreementId3")).to.eq(0);
    });
  });
});
