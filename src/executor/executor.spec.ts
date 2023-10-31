import { MarketService } from "../market/";
import { AgreementPoolService } from "../agreement/";
import { TaskService } from "../task/";
import { TaskExecutor } from "./executor";
import { sleep } from "../utils";
import { LoggerMock } from "../../tests/mock";

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("../market/service");
jest.mock("../agreement/service");
jest.mock("../network/service");
jest.mock("../task/service");
jest.mock("../storage/gftp");
jest.mock("../utils/yagna/yagna");

const serviceRunSpy = jest.fn().mockImplementation(() => Promise.resolve());
jest.spyOn(MarketService.prototype, "run").mockImplementation(serviceRunSpy);
jest.spyOn(AgreementPoolService.prototype, "run").mockImplementation(serviceRunSpy);
jest.spyOn(TaskService.prototype, "run").mockImplementation(serviceRunSpy);

jest.mock("../payment/service", () => {
  return {
    PaymentService: jest.fn().mockImplementation(() => {
      return {
        config: { payment: { network: "test" } },
        createAllocation: jest.fn(),
        run: serviceRunSpy,
        end: jest.fn(),
      };
    }),
  };
});

describe("Task Executor", () => {
  const logger = new LoggerMock();
  const yagnaOptions = { apiKey: "test" };
  beforeEach(() => {
    jest.clearAllMocks();
    logger.clear();
  });

  describe("init()", () => {
    it("should run all set services", async () => {
      const executor = await TaskExecutor.create({ package: "test", logger, yagnaOptions });
      expect(serviceRunSpy).toHaveBeenCalledTimes(4);
      expect(executor).toBeDefined();
      await executor.end();
    });
    it("should handle a critical error if startup timeout is reached", async () => {
      const executor = await TaskExecutor.create({ package: "test", startupTimeout: 0, logger, yagnaOptions });
      jest
        .spyOn(MarketService.prototype, "getProposalsCount")
        .mockImplementation(() => ({ confirmed: 0, initial: 0, rejected: 0 }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleErrorSpy = jest.spyOn(executor as any, "handleCriticalError").mockImplementation((error) => {
        expect((error as Error).message).toEqual(
          "Could not start any work on Golem. Processed 0 initial proposals from yagna, filters accepted 0. Check your demand if it's not too restrictive or restart yagna.",
        );
      });
      await sleep(10, true);
      expect(handleErrorSpy).toHaveBeenCalled();
      await executor.end();
    });
  });

  describe("end()", () => {
    it("should allow multiple calls", async () => {
      // Implementation details: the same promise is always used, so it's safe to call end() multiple times.
      const executor = await TaskExecutor.create({ package: "test", startupTimeout: 0, logger, yagnaOptions });
      const p = Promise.resolve();
      const spy = jest.spyOn(executor as any, "doEnd").mockReturnValue(p);

      const r1 = executor.end();
      expect(r1).toBeDefined();
      expect(r1).toStrictEqual(p);

      const r2 = executor.end();
      expect(r1).toStrictEqual(r2);

      await r1;

      const r3 = executor.end();
      expect(r3).toStrictEqual(r1);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
