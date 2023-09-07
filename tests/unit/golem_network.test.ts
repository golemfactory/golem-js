import { GolemNetwork } from "../../src/golem_network/golem_network";

const NOT_INITIALIZED_ERROR = new Error("GolemNetwork not initialized, please run init() first");

describe.only("Golem Network", () => {
  describe("Init", () => {
    it("should throw error when starting a job if not initialized", async () => {
      const golem = new GolemNetwork({});
      await expect(golem.createJob(async () => {})).rejects.toThrowError(NOT_INITIALIZED_ERROR);
    });
    it("should throw error when running a task if not initialized", async () => {
      const golem = new GolemNetwork({});
      await expect(golem.runTask(async () => {})).rejects.toThrowError(NOT_INITIALIZED_ERROR);
    });
    it("should throw error when getting a job if not initialized", () => {
      const golem = new GolemNetwork({});
      expect(() => golem.getJobById("")).toThrowError(NOT_INITIALIZED_ERROR);
    });
  });
});
