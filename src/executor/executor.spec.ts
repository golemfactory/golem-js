import { MarketService } from "../market/";
import { AgreementPoolService } from "../agreement/";
import { Task, TaskService } from "../task/";
import { TaskExecutor } from "./executor";
import { sleep } from "../utils";
import { LoggerMock } from "../../tests/mock";
import { GolemConfigurationError } from "../error/golem-error";
import { GolemWorkError, WorkErrorCode } from "../task/error";

/* eslint-disable @typescript-eslint/no-explicit-any */

jest.mock("../market/service");
jest.mock("../agreement/service");
jest.mock("../network/service");
jest.mock("../task/service");
jest.mock("../storage/gftp");
jest.mock("../utils/yagna/yagna");
jest.mock("../task/task");

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
      await executor.shutdown();
    });
    it("should handle a critical error if startup timeout is reached and exitOnNoProposals is enabled", async () => {
      const executor = await TaskExecutor.create({
        package: "test",
        startupTimeout: 0,
        exitOnNoProposals: true,
        logger,
        yagnaOptions,
      });
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
      await executor.shutdown();
    });
    it("should only warn the user if startup timeout is reached and exitOnNoProposals is disabled", async () => {
      const executor = await TaskExecutor.create({
        package: "test",
        startupTimeout: 0,
        exitOnNoProposals: false,
        logger,
        yagnaOptions,
      });
      jest
        .spyOn(MarketService.prototype, "getProposalsCount")
        .mockImplementation(() => ({ confirmed: 0, initial: 0, rejected: 0 }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleErrorSpy = jest.spyOn(executor as any, "handleCriticalError");
      const consoleErrorSpy = jest.spyOn(globalThis.console, "error").mockImplementation(() => {});

      await sleep(10, true);

      expect(handleErrorSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Could not start any work on Golem. Processed 0 initial proposals from yagna, filters accepted 0. Check your demand if it's not too restrictive or restart yagna.",
      );
      await executor.shutdown();
    });

    it("should pass zero for the Task entity if the maxTaskRetires option is zero", async () => {
      const executor = await TaskExecutor.create({
        package: "test",
        maxTaskRetries: 0,
        logger,
        yagnaOptions,
      });
      jest.spyOn(Task.prototype, "isQueueable").mockImplementation(() => true);
      jest.spyOn(Task.prototype, "isFinished").mockImplementation(() => true);

      const worker = () => Promise.resolve(true);
      await executor.run(worker);
      expect(Task).toHaveBeenCalledWith("1", worker, {
        activityReadySetupFunctions: [],
        maxRetries: 0,
        timeout: 300000,
      });
      await executor.shutdown();
    });

    it("should pass zero for the Task entity if the maxRetires params in run method is zero", async () => {
      const executor = await TaskExecutor.create({
        package: "test",
        maxTaskRetries: 7,
        logger,
        yagnaOptions,
      });
      jest.spyOn(Task.prototype, "isQueueable").mockImplementation(() => true);
      jest.spyOn(Task.prototype, "isFinished").mockImplementation(() => true);

      const worker = () => Promise.resolve(true);
      await executor.run(worker, { maxRetries: 0 });
      expect(Task).toHaveBeenCalledWith("1", worker, {
        activityReadySetupFunctions: [],
        maxRetries: 0,
        timeout: 300000,
      });
      await executor.shutdown();
    });

    it("should throw an error if the value of maxTaskRetries is less than zero", async () => {
      const executorPromise = TaskExecutor.create({
        package: "test",
        maxTaskRetries: -1,
        logger,
        yagnaOptions,
      });
      await expect(executorPromise).rejects.toThrow(
        new GolemConfigurationError("The maxTaskRetries parameter cannot be less than zero"),
      );
    });

    it('should emit "ready" event after init() completes', async () => {
      const ready = jest.fn();

      const executor = new TaskExecutor({ package: "test", logger, yagnaOptions });
      executor.events.on("ready", ready);
      await executor.init();

      expect(serviceRunSpy).toHaveBeenCalledTimes(4);
      expect(ready).toHaveBeenCalledTimes(1);
      await executor.shutdown();
    });
  });

  describe("run()", () => {
    it("should run all tasks even if some fail", async () => {
      const executor = await TaskExecutor.create({ package: "test", logger, yagnaOptions });

      jest.spyOn(Task.prototype, "isFinished").mockImplementation(() => true);
      const executorShutdownSpy = jest.spyOn(executor as any, "doShutdown");

      const rejectedSpy = jest.spyOn(Task.prototype, "isRejected");
      const resultsSpy = jest.spyOn(Task.prototype, "getResults");
      const errorSpy = jest.spyOn(Task.prototype, "getError");

      rejectedSpy.mockImplementationOnce(() => false);
      resultsSpy.mockImplementationOnce(() => "result 1");
      await expect(executor.run(() => Promise.resolve())).resolves.toEqual("result 1");

      rejectedSpy.mockImplementationOnce(() => true);
      errorSpy.mockImplementationOnce(() => new Error("error 1"));
      await expect(executor.run(() => Promise.resolve())).rejects.toThrow(
        new GolemWorkError("Unable to execute task. Error: error 1", WorkErrorCode.ScriptExecutionFailed),
      );

      rejectedSpy.mockImplementationOnce(() => false);
      resultsSpy.mockImplementationOnce(() => "result 2");
      await expect(executor.run(() => Promise.resolve())).resolves.toEqual("result 2");

      expect(rejectedSpy).toHaveBeenCalledTimes(3);
      expect(resultsSpy).toHaveBeenCalledTimes(2);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(executorShutdownSpy).toHaveBeenCalledTimes(0);

      await executor.shutdown();
    });
    it("should only warn the user if startup timeout is reached and exitOnNoProposals is disabled", async () => {
      const executor = await TaskExecutor.create({
        package: "test",
        startupTimeout: 0,
        exitOnNoProposals: false,
        logger,
        yagnaOptions,
      });
      jest
        .spyOn(MarketService.prototype, "getProposalsCount")
        .mockImplementation(() => ({ confirmed: 0, initial: 0, rejected: 0 }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handleErrorSpy = jest.spyOn(executor as any, "handleCriticalError");
      const consoleErrorSpy = jest.spyOn(globalThis.console, "error").mockImplementation(() => {});

      await sleep(10, true);

      expect(handleErrorSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Could not start any work on Golem. Processed 0 initial proposals from yagna, filters accepted 0. Check your demand if it's not too restrictive or restart yagna.",
      );
      await executor.shutdown();
    });
  });

  describe("end()", () => {
    it("should call shutdown()", async () => {
      const executor = await TaskExecutor.create({ package: "test", startupTimeout: 0, logger, yagnaOptions });
      const spy = jest.spyOn(executor, "shutdown");
      await executor.shutdown();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("shutdown()", () => {
    it("should allow multiple calls", async () => {
      // Implementation details: the same promise is always used, so it's safe to call end() multiple times.
      const executor = await TaskExecutor.create({ package: "test", startupTimeout: 0, logger, yagnaOptions });
      const p = Promise.resolve();
      const spy = jest.spyOn(executor as any, "doShutdown").mockReturnValue(p);

      const r1 = executor.shutdown();
      expect(r1).toBeDefined();
      expect(r1).toStrictEqual(p);

      const r2 = executor.shutdown();
      expect(r1).toStrictEqual(r2);

      await r1;

      const r3 = executor.shutdown();
      expect(r3).toStrictEqual(r1);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('it should emit "beforeEnd" and "end" events', async () => {
      const executor = await TaskExecutor.create({ package: "test", startupTimeout: 0, logger, yagnaOptions });
      const beforeEnd = jest.fn();
      const end = jest.fn();

      executor.events.on("beforeEnd", beforeEnd);
      executor.events.on("end", end);

      await executor.shutdown();
      // Second call shouldn't generate new events.
      await executor.shutdown();

      // Both events should have been fired.
      expect(beforeEnd).toHaveBeenCalledTimes(1);
      expect(end).toHaveBeenCalledTimes(1);
    });
  });
});
