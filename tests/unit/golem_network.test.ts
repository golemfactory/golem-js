import { TaskExecutor } from "../../src/executor";
import { GolemNetwork } from "../../src/golem_network";
import { JobStorage } from "../../src/golem_network/job_storage";

function getMockExecutor() {
  return {
    create: jest.fn().mockReturnThis(),
    run: jest.fn().mockImplementation((jobDescription) => jobDescription({})),
    end: jest.fn().mockResolvedValue(""),
  } as unknown as TaskExecutor;
}

function getMockStorage({ ...overrides } = {}) {
  return {
    getJobStatus: jest.fn().mockResolvedValue(null),
    getJobResult: jest.fn().mockResolvedValue(null),
    setJobStatus: jest.fn().mockResolvedValue(null),
    setJobResult: jest.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as JobStorage;
}

describe("Golem Network", () => {
  describe("Creating/Destroying Golem Network instance", () => {
    it("should consider itself initialized if executor is created", async () => {
      const mockExecutor = getMockExecutor();
      const network = new GolemNetwork({});
      expect(network.isInitialized()).toEqual(false);
      network["executor"] = mockExecutor;
      expect(network.isInitialized()).toEqual(true);
    });
    it("should close executor on close()", async () => {
      const mockExecutor = getMockExecutor();
      const network = new GolemNetwork({});
      network["executor"] = mockExecutor;
      await network.close();
      expect(mockExecutor.end).toHaveBeenCalled();
    });
  });
  describe("Running a job", () => {
    it("should throw if network is not initialized", async () => {
      const network = new GolemNetwork({});
      await expect(network.runJob({ jobDescription: async () => {} })).rejects.toThrowError(
        "GolemNetwork not initialized, please run init() first",
      );
    });
    it("should create a job with a unique id", async () => {
      const mockExecutor = getMockExecutor();
      const network = new GolemNetwork({});
      network["executor"] = mockExecutor;
      const jobId = await network.runJob({ jobDescription: async () => {} });
      expect(jobId).toBeDefined();
      const jobId2 = await network.runJob({ jobDescription: async () => {} });
      expect(jobId2).toBeDefined();
      expect(jobId).not.toEqual(jobId2);
    });
    it("should create a job with a jobDescription", async () => {
      const mockExecutor = getMockExecutor();
      const network = new GolemNetwork({});
      network["executor"] = mockExecutor;
      const jobDescription = jest.fn();
      const jobId = await network.runJob({
        jobDescription,
      });
      const status = await network.getJobStatus(jobId);
      expect(status).toEqual("running");
      expect(mockExecutor.run).toHaveBeenCalledTimes(1);
      expect(jobDescription).toHaveBeenCalledTimes(1);
    });
    it("should set the job status to finished when job finishes successfully", async () => {
      const mockExecutor = getMockExecutor();
      const network = new GolemNetwork({});
      network["executor"] = mockExecutor;
      const jobDescription = jest.fn();
      const jobId = await network.runJob({
        jobDescription,
      });

      // wait for the job to finish
      await new Promise(process.nextTick);
      const status = await network.getJobStatus(jobId);
      expect(status).toEqual("finished");
    });
    it("should set the job status to failed when job fails", async () => {
      const mockExecutor = getMockExecutor();
      const network = new GolemNetwork({});
      network["executor"] = mockExecutor;
      const jobDescription = jest.fn().mockImplementation(() => {
        throw new Error("Job failed");
      });
      const jobId = await network.runJob({
        jobDescription,
      });

      // wait for the job to finish
      await new Promise(process.nextTick);
      const status = await network.getJobStatus(jobId);
      expect(status).toEqual("failed");
    });
  });
  describe("Storage", () => {
    it("should store job status and result", async () => {
      const mockExecutor = getMockExecutor();
      const mockStorage = getMockStorage({
        getJobStatus: jest.fn().mockResolvedValue("running"),
      });
      const network = new GolemNetwork({ jobStorage: mockStorage });
      network["executor"] = mockExecutor;

      const jobId = await network.runJob({
        jobDescription: async () => "result",
      });

      expect(mockStorage.setJobStatus).toHaveBeenLastCalledWith(jobId, "running");
      const _status = await network.getJobStatus(jobId);
      expect(mockStorage.getJobStatus).toHaveBeenLastCalledWith(jobId);

      // wait for the job to finish
      await new Promise(process.nextTick);
      const _result = await network.getJobResult(jobId);
      expect(mockStorage.setJobStatus).toHaveBeenLastCalledWith(jobId, "finished");
      expect(mockStorage.setJobResult).toHaveBeenCalledWith(jobId, "result");
    });
    it("should throw if job is not found", async () => {
      const mockExecutor = getMockExecutor();
      const mockStorage = getMockStorage();
      const network = new GolemNetwork({ jobStorage: mockStorage });
      network["executor"] = mockExecutor;
      await expect(network.getJobStatus("jobId")).rejects.toThrowError("Job jobId not found");
      expect(mockStorage.getJobStatus).toHaveBeenCalledWith("jobId");
    });
  });
});
