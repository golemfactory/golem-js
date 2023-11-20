const onActivityReadyMock = { onActivityReady: jest.fn() };
const createMock = jest.fn().mockResolvedValue(onActivityReadyMock);

jest.doMock("../../src/executor", () => ({
  TaskExecutor: {
    create: createMock,
  },
}));
import { GolemNetwork } from "../../src/golem_network/golem_network";

afterEach(() => {
  jest.clearAllMocks();
});

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
  describe("Config", () => {
    it("should pass all relevant configuration to the underlying TaskExecutor", async () => {
      const config = {
        image: "image",
        enableLogging: true,
        demand: {
          capabilities: ["vpn"],
          minCpuCores: 1,
          minCpuThreads: 2,
          minMemGib: 3,
          minStorageGib: 4,
        },
        yagnaOptions: {
          apiKey: "apiKey",
          basePath: "basePath",
        },
        beforeEachJob: async () => {},
        jobStorage: {
          setJob: async () => {},
          getJob: async () => null,
        },
      };
      const golem = new GolemNetwork(config);
      await golem.init();
      expect(createMock).toHaveBeenCalledWith({
        package: "image",
        enableLogging: true,
        yagnaOptions: {
          apiKey: "apiKey",
          basePath: "basePath",
        },
        capabilities: ["vpn"],
        minCpuCores: 1,
        minCpuThreads: 2,
        minMemGib: 3,
        minStorageGib: 4,
        jobStorage: config.jobStorage,
      });
      expect(onActivityReadyMock.onActivityReady).toHaveBeenCalledWith(config.beforeEachJob);
    });
  });
});
