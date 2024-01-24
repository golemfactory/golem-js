import { Batch, WorkContext } from "./index";
import { LoggerMock, YagnaMock } from "../../tests/mock";
import { ActivityStateEnum, ResultState } from "../activity";
import { DownloadData, DownloadFile, Run, Script, Transfer, UploadData, UploadFile } from "../script";
import { ActivityMock } from "../../tests/mock/activity.mock";
import { agreement } from "../../tests/mock/entities/agreement";

/* eslint-disable @typescript-eslint/no-explicit-any */

const logger = new LoggerMock();
describe("Work Context", () => {
  let context: WorkContext;
  let activity: ActivityMock;

  beforeEach(() => {
    logger.clear();
    activity = new ActivityMock("test_id", agreement, new YagnaMock().getApi());
    context = new WorkContext(activity, {
      logger: logger,
    });
  });

  describe("Commands", () => {
    let runSpy: jest.SpyInstance;

    beforeEach(() => {
      runSpy = jest.spyOn(context as any, "runOneCommand");
    });

    describe("run()", () => {
      it("should execute run command", async () => {
        const result = ActivityMock.createResult({ stdout: "Ok" });
        runSpy.mockImplementation((cmd) => {
          expect(cmd).toBeInstanceOf(Run);
          return Promise.resolve(result);
        });
        expect(await context.run("rm -rf")).toBe(result);
      });

      it("should execute run command", async () => {
        const result = ActivityMock.createResult({ stdout: "Ok" });
        runSpy.mockImplementation((cmd) => {
          expect(cmd).toBeInstanceOf(Run);
          return Promise.resolve(result);
        });
        expect(await context.run("/bin/ls", ["-R"])).toBe(result);
      });
    });

    describe("spawn()", () => {
      it("should execute spawn command", async () => {
        const expectedResult = ActivityMock.createResult({ stdout: "Output", stderr: "Error", isBatchFinished: true });
        activity.mockResults([expectedResult]);
        const remoteProcess = await context.spawn("rm -rf");
        for await (const result of remoteProcess.stdout) {
          expect(result).toBe("Output");
        }
        for await (const result of remoteProcess.stderr) {
          expect(result).toBe("Error");
        }
        const finalResult = await remoteProcess.waitForExit();
        expect(finalResult.result).toBe(ResultState.Ok);
      });
    });

    describe("transfer()", () => {
      it("should execute transfer command", async () => {
        const result = ActivityMock.createResult({ stdout: "Ok" });
        runSpy.mockImplementation((cmd) => {
          expect(cmd).toBeInstanceOf(Transfer);
          expect(cmd["from"]).toBe("http://golem.network/test.txt");
          expect(cmd["to"]).toBe("/golem/work/test.txt");
          return Promise.resolve(result);
        });
        expect(await context.transfer("http://golem.network/test.txt", "/golem/work/test.txt")).toBe(result);
      });
    });

    describe("uploadFile()", () => {
      it("should execute upload file command", async () => {
        const result = ActivityMock.createResult();
        runSpy.mockImplementation((cmd: UploadFile) => {
          expect(cmd).toBeInstanceOf(UploadFile);
          expect(cmd["src"]).toBe("/tmp/file.txt");
          expect(cmd["dstPath"]).toBe("/golem/file.txt");

          return Promise.resolve(result);
        });
        expect(await context.uploadFile("/tmp/file.txt", "/golem/file.txt")).toBe(result);
      });
    });

    describe("uploadJson()", () => {
      it("should execute upload json command", async () => {
        const input = { hello: "world" };
        const result = ActivityMock.createResult();
        runSpy.mockImplementation((cmd: UploadData) => {
          expect(cmd).toBeInstanceOf(UploadData);
          const data = new TextDecoder().decode(cmd["src"]);
          expect(JSON.parse(data)).toEqual(input);
          expect(cmd["dstPath"]).toBe("/golem/file.txt");

          return Promise.resolve(result);
        });
        expect(await context.uploadJson(input, "/golem/file.txt")).toBe(result);
      });
    });

    describe("uploadData()", () => {
      it("should execute upload json command", async () => {
        const input = "Hello World";
        const result = ActivityMock.createResult();
        runSpy.mockImplementation((cmd: UploadData) => {
          expect(cmd).toBeInstanceOf(UploadData);
          expect(new TextDecoder().decode(cmd["src"])).toEqual(input);
          expect(cmd["dstPath"]).toBe("/golem/file.txt");

          return Promise.resolve(result);
        });
        expect(await context.uploadData(new TextEncoder().encode(input), "/golem/file.txt")).toBe(result);
      });
    });

    describe("downloadFile()", () => {
      it("should execute download file command", async () => {
        const result = ActivityMock.createResult();
        runSpy.mockImplementation((cmd: UploadData) => {
          expect(cmd).toBeInstanceOf(DownloadFile);
          expect(cmd["srcPath"]).toBe("/golem/file.txt");
          expect(cmd["dstPath"]).toBe("/tmp/file.txt");

          return Promise.resolve(result);
        });
        expect(await context.downloadFile("/golem/file.txt", "/tmp/file.txt")).toBe(result);
      });
    });

    describe("downloadJson()", () => {
      it("should execute download json command", async () => {
        const json = { hello: "World" };
        const data = new TextEncoder().encode(JSON.stringify(json)).buffer;
        const resultInput = ActivityMock.createResult({ data: data });
        runSpy.mockImplementation((cmd: DownloadData) => {
          expect(cmd).toBeInstanceOf(DownloadData);
          expect(cmd["srcPath"]).toBe("/golem/file.txt");

          return Promise.resolve(resultInput);
        });

        const result = await context.downloadJson("/golem/file.txt");
        expect(result.result).toEqual(ResultState.Ok);
        expect(result.data).toEqual(json);
      });
    });

    describe("downloadData()", () => {
      it("should execute download data command", async () => {
        const result = ActivityMock.createResult({ data: new Uint8Array(10) });
        runSpy.mockImplementation((cmd: UploadData) => {
          expect(cmd).toBeInstanceOf(DownloadData);
          expect(cmd["srcPath"]).toBe("/golem/file.txt");

          return Promise.resolve(result);
        });
        expect(await context.downloadData("/golem/file.txt")).toBe(result);
      });
    });

    describe("runOneCommand()", () => {
      it("should abort if script.before() fails", async () => {
        jest.spyOn(Script.prototype, "before").mockRejectedValue(new Error("[test]"));
        try {
          await context["runOneCommand"](new Run("test"));
          fail("Should throw error");
        } catch (e) {
          expect(e.message).toContain("[test]");
        }
      });

      it("should return result on success", async () => {
        jest.spyOn(Script.prototype, "before").mockResolvedValue(undefined);
        activity.mockResults([ActivityMock.createResult({ stdout: "SUCCESS" })]);
        const result = await context["runOneCommand"](new Run("test"));
        expect(result.result).toEqual(ResultState.Ok);
        expect(result.stdout).toEqual("SUCCESS");
      });

      it("should handle error result", async () => {
        jest.spyOn(Script.prototype, "before").mockResolvedValue(undefined);
        activity.mockResults([ActivityMock.createResult({ result: ResultState.Error, stdout: "FAILURE" })]);
        const result = await context["runOneCommand"](new Run("test"));
        expect(result.result).toEqual(ResultState.Error);
        expect(result.stdout).toEqual("FAILURE");
        await logger.expectToInclude("Task error", {
          error: "Error: undefined. Stdout: FAILURE. Stderr: undefined",
          provider: "Test Provider",
        });
      });
    });
  });

  describe("getState()", () => {
    it("should return activity state", async () => {
      activity.mockCurrentState(ActivityStateEnum.Deployed);
      await expect(context.getState()).resolves.toEqual(ActivityStateEnum.Deployed);
      activity.mockCurrentState(ActivityStateEnum.Ready);
      await expect(context.getState()).resolves.toEqual(ActivityStateEnum.Ready);
    });
  });

  describe("getWebsocketUri()", () => {
    it("should throw error if there is no network node", () => {
      expect(() => context.getIp()).toThrow(new Error("There is no network in this work context"));
    });

    it("should return websocket URI", () => {
      (context as any)["networkNode"] = {
        getWebsocketUri: (port: number) => `ws://localhost:${port}`,
      };
      const spy = jest.spyOn(context["networkNode"] as any, "getWebsocketUri").mockReturnValue("ws://local");
      expect(context.getWebsocketUri(20)).toEqual("ws://local");
      expect(spy).toHaveBeenCalledWith(20);
    });
  });

  describe("getIp()", () => {
    it("should throw error if there is no network node", () => {
      expect(() => context.getIp()).toThrow(new Error("There is no network in this work context"));
    });

    it("should return ip address of provider vpn network node", () => {
      (context as any)["networkNode"] = {
        ip: "192.168.0.2",
      };
      expect(context.getIp()).toEqual("192.168.0.2");
    });
  });

  describe("beginBatch()", () => {
    it("should create a batch object", () => {
      const o = {};
      const spy = jest.spyOn(Batch, "create").mockReturnValue(o as any);
      const result = context.beginBatch();
      expect(result).toBe(o);
      expect(spy).toHaveBeenCalledWith(context["activity"], context["storageProvider"], context["logger"]);
    });
  });

  describe("setupActivity()", () => {
    it("should call all setup functions in the order they were registered", async () => {
      const calls: string[] = [];
      const activityReadySetupFunctions = [
        async () => calls.push("1"),
        async () => calls.push("2"),
        async () => calls.push("3"),
      ];
      context = new WorkContext(activity, {
        logger: logger,
        activityReadySetupFunctions,
      });

      await context["setupActivity"]();
      expect(calls).toEqual(["1", "2", "3"]);
    });
  });
});
