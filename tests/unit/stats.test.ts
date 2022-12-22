import { Tasks } from "../../yajsapi/stats/tasks";
import { expect } from "chai";

describe("Stats Module", () => {
  describe("Tasks", () => {
    it("should addStartTime() set setup startTime", async () => {
      const tests = new Tasks();
      tests.addStartTime(1000);
      expect(tests.startTime).to.equal(1000);
    });
    it("should addStopTime() set setup stopTime", async () => {
      const tests = new Tasks();
      tests.addStopTime(1000);
      expect(tests.stopTime).to.equal(1000);
    });
    it("should startTask() should add tasks", async () => {
      const tests = new Tasks();
      tests.startTask("id", "agreementId", "activityId", "timestamp": 1000)
      expect(tests.stopTime).to.equal(1000);
    });
  });
});
