import {
  Activity,
  ActivityModule,
  ActivityStateEnum,
  Agreement,
  GolemModuleError,
  GolemWorkError,
  IActivityApi,
  NetworkNode,
  StorageProvider,
  WorkContext,
  WorkErrorCode,
  YagnaExeScriptObserver,
} from "../../src";
import { _, anyOfClass, anything, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { buildExecutorResults, buildExeScriptErrorResult, buildExeScriptSuccessResult } from "./helpers";
import { IPv4 } from "ip-num";
import { StorageProviderDataCallback } from "../../src/shared/storage/provider";
import { ActivityApi } from "ya-ts-client";
import { ExeScriptExecutor } from "../../src/activity/exe-script-executor";
import { INetworkApi } from "../../src/network/api";

const mockActivityApi = imock<IActivityApi>();
const mockNetworkApi = imock<INetworkApi>();
const mockActivity = mock(Activity);
const mockExecutor = mock(ExeScriptExecutor);
const mockActivityControl = imock<ActivityApi.RequestorControlService>();
const mockExecObserver = imock<YagnaExeScriptObserver>();
const mockStorageProvider = imock<StorageProvider>();
const mockAgreement = mock(Agreement);
const mockActivityModule = imock<ActivityModule>();

describe("Work Context", () => {
  beforeEach(() => {
    // Make mocks ready to re-use
    reset(mockActivityApi);
    reset(mockNetworkApi);
    reset(mockActivity);
    reset(mockActivityControl);
    reset(mockExecObserver);
    reset(mockStorageProvider);
    reset(mockAgreement);
    reset(mockActivityModule);
    when(mockActivity.provider).thenReturn({
      id: "test-provider-id",
      name: "test-provider-name",
      walletAddress: "0xProviderWallet",
    });
    when(mockActivityModule.createScriptExecutor(_, _)).thenReturn(instance(mockExecutor));
    when(mockActivity.getState()).thenReturn(ActivityStateEnum.Ready);
    when(mockActivityModule.refreshActivity(_)).thenResolve(instance(mockActivity));
    when(mockActivity.agreement).thenReturn(instance(mockAgreement));
    when(mockExecutor.activity).thenReturn(instance(mockActivity));
  });

  describe("Executing", () => {
    it("should execute run command with a single parameter", async () => {
      when(mockExecutor.execute(_, _, _)).thenResolve(
        buildExecutorResults([
          {
            index: 0,
            eventDate: new Date().toISOString(),
            result: "Ok",
            stdout: "test_result",
            isBatchFinished: true,
          },
        ]),
      );

      const worker = async (ctx: WorkContext) => ctx.run("some_shell_command");
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule));
      await ctx.before();
      const results = await worker(ctx);
      expect(results?.stdout).toEqual("test_result");
    });

    it("should execute run command with multiple parameters", async () => {
      when(mockExecutor.execute(_, _, _)).thenResolve(
        buildExecutorResults([
          {
            index: 0,
            eventDate: new Date().toISOString(),
            result: "Ok",
            stdout: "test_result_from_ls",
            isBatchFinished: true,
          },
        ]),
      );

      const worker = async (ctx: WorkContext) => ctx.run("/bin/ls", ["-R"]);
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule));
      await ctx.before();
      const results = await worker(ctx);

      expect(results?.stdout).toEqual("test_result_from_ls");
    });

    describe("upload commands", () => {
      it("should execute upload file command", async () => {
        const worker = async (ctx: WorkContext) => ctx.uploadFile("./file.txt", "/golem/file.txt");

        when(mockExecutor.execute(_, _, _)).thenResolve(
          buildExecutorResults([
            {
              index: 0,
              eventDate: new Date().toISOString(),
              result: "Ok",
              stdout: "test_result",
              isBatchFinished: true,
            },
          ]),
        );

        const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
          storageProvider: instance(mockStorageProvider),
        });
        await ctx.before();
        const results = await worker(ctx);
        expect(results?.stdout).toEqual("test_result");
        verify(mockStorageProvider.publishFile("./file.txt")).once();
      });

      it("should execute upload json command", async () => {
        const worker = async (ctx: WorkContext) => ctx.uploadJson({ test: true }, "/golem/file.txt");

        when(mockExecutor.execute(_, _, _)).thenResolve(
          buildExecutorResults([
            {
              index: 0,
              eventDate: new Date().toISOString(),
              result: "Ok",
              stdout: "test_result",
              isBatchFinished: true,
            },
          ]),
        );

        const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
          storageProvider: instance(mockStorageProvider),
        });
        await ctx.before();
        const results = await worker(ctx);

        expect(results?.stdout).toEqual("test_result");
        verify(mockStorageProvider.publishData(anyOfClass(Uint8Array))).once();
      });
    });

    describe("download commands", () => {
      it("should execute download file command", async () => {
        const worker = async (ctx: WorkContext) => ctx.downloadFile("/golem/file.txt", "./file.txt");

        when(mockExecutor.execute(_, _, _)).thenResolve(
          buildExecutorResults([
            {
              index: 0,
              eventDate: new Date().toISOString(),
              result: "Ok",
              stdout: "test_result",
              isBatchFinished: true,
            },
          ]),
        );

        const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
          storageProvider: instance(mockStorageProvider),
        });

        await ctx.before();
        const results = await worker(ctx);

        expect(results?.stdout).toEqual("test_result");
        verify(mockStorageProvider.receiveFile("./file.txt")).once();
      });

      it("should execute download json command", async () => {
        const json = { hello: "World" };
        const jsonStr = JSON.stringify(json);
        const encoded = new TextEncoder().encode(jsonStr);

        when(mockExecutor.execute(_, _, _)).thenResolve(
          buildExecutorResults([
            {
              index: 0,
              eventDate: new Date().toISOString(),
              result: "Ok",
              data: encoded.buffer,
              isBatchFinished: true,
            },
          ]),
        );

        when(mockStorageProvider.receiveData(anything())).thenCall(async (onData: StorageProviderDataCallback) => {
          onData(encoded);
          return "/golem/file.txt";
        });

        const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
          storageProvider: instance(mockStorageProvider),
        });
        const result = await ctx.downloadJson("/golem/file.txt");

        expect(result.result).toEqual("Ok");
        expect(result.data).toEqual(json);
      });

      it("should execute download data command", async () => {
        const data = new Uint8Array(10);

        const eventDate = new Date().toISOString();

        when(mockStorageProvider.receiveData(anything())).thenResolve(data.toString());

        when(mockExecutor.execute(_, _, _)).thenResolve(
          buildExecutorResults([
            {
              index: 0,
              eventDate: eventDate,
              result: "Ok",
              data: data,
              isBatchFinished: true,
            },
          ]),
        );

        when(mockStorageProvider.receiveData(anything())).thenCall(async (onData: StorageProviderDataCallback) => {
          onData(data);
          return "/golem/file.txt";
        });

        const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
          storageProvider: instance(mockStorageProvider),
        });
        const result = await ctx.downloadData("/golem/file.txt");

        expect(result).toEqual(
          expect.objectContaining({
            index: 0,
            eventDate: eventDate,
            result: "Ok",
            data: data,
          }),
        );
      });
    });
  });

  describe("Exec and stream", () => {
    it("should execute runAndStream command", async () => {
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule));
      when(mockExecutor.execute(_, _, _)).thenResolve(
        buildExecutorResults([
          {
            index: 0,
            eventDate: new Date().toISOString(),
            result: "Ok",
            isBatchFinished: true,
          },
        ]),
      );
      const remote = await ctx.runAndStream("rm -rf foo/");

      const finalResult = await remote.waitForExit();
      expect(finalResult.result).toBe("Ok");
    });
  });

  describe("transfer()", () => {
    it("should execute transfer command", async () => {
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule));

      when(mockExecutor.execute(_, _, _)).thenResolve(
        buildExecutorResults([
          {
            index: 0,
            eventDate: new Date().toISOString(),
            result: "Ok",
            stdout: "Ok",
            stderr: "",
            isBatchFinished: true,
          },
        ]),
      );

      const remote = await ctx.transfer("http://golem.network/test.txt", "/golem/work/test.txt");
      expect(remote.result).toEqual("Ok");
    });
  });

  describe("Batch", () => {
    it("should execute batch as promise", async () => {
      const worker = async (ctx: WorkContext) => {
        return ctx
          .beginBatch()
          .run("some_shell_command")
          .uploadFile("./file.txt", "/golem/file.txt")
          .uploadJson({ test: true }, "/golem/file.txt")
          .downloadFile("/golem/file.txt", "./file.txt")
          .end();
      };
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
        storageProvider: instance(mockStorageProvider),
      });
      const expectedStdout = [
        { stdout: "ok_run" },
        { stdout: "ok_upload_file" },
        { stdout: "ok_upload_json" },
        { stdout: "ok_download_file" },
      ];

      when(mockExecutor.execute(_)).thenResolve(
        buildExecutorResults(expectedStdout.map((e) => buildExeScriptSuccessResult(e.stdout))),
      );

      const results = await worker(ctx);
      expect(results?.map((r) => r.stdout)).toEqual(expectedStdout.map((s) => s.stdout));

      verify(mockStorageProvider.publishFile("./file.txt")).once();
      verify(mockStorageProvider.publishData(anyOfClass(Uint8Array))).once();
      verify(mockStorageProvider.receiveFile("./file.txt")).once();
    });

    it("should execute batch as stream", async () => {
      const worker = async (ctx: WorkContext) => {
        return ctx
          .beginBatch()
          .run("some_shell_command")
          .uploadFile("./file.txt", "/golem/file.txt")
          .uploadJson({ test: true }, "/golem/file.txt")
          .downloadFile("/golem/file.txt", "./file.txt")
          .endStream();
      };
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
        storageProvider: instance(mockStorageProvider),
      });
      const expectedStdout = [
        { stdout: "ok_run" },
        { stdout: "ok_upload_file" },
        { stdout: "ok_upload_json" },
        { stdout: "ok_download_file" },
      ];

      when(mockExecutor.execute(_)).thenResolve(
        buildExecutorResults(expectedStdout.map((e) => buildExeScriptSuccessResult(e.stdout))),
      );

      const results = await worker(ctx);
      await new Promise((res, rej) => {
        results?.on("data", (result) => {
          try {
            expect(result.stdout).toEqual(expectedStdout?.shift()?.stdout);
          } catch (e) {
            rej(e);
          }
        });
        results?.on("end", res);
      });

      verify(mockStorageProvider.publishFile("./file.txt")).once();
      verify(mockStorageProvider.publishData(anyOfClass(Uint8Array))).once();
      verify(mockStorageProvider.receiveFile("./file.txt")).once();
    });
  });

  describe("fetchState() helper function", () => {
    it("should return activity state", async () => {
      when(mockActivity.getState()).thenReturn(ActivityStateEnum.Deployed);
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule));
      await expect(ctx["fetchState"]()).resolves.toEqual(ActivityStateEnum.Deployed);
    });
  });

  describe("getIp()", () => {
    it("should throw error if there is no network node", async () => {
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule));

      expect(() => ctx.getIp()).toThrow(new Error("There is no network in this work context"));
    });

    it("should return ip address of provider vpn network node", async () => {
      const networkNode = new NetworkNode(
        "test-node",
        "192.168.0.10",
        () => ({
          id: "test-network",
          ip: "192.168.0.0/24",
          nodes: {
            "192.168.0.10": "example-provider-id",
          },
          mask: "255.255.255.0",
        }),
        "http://127.0.0.1:7465",
      );
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
        networkNode,
      });

      expect(ctx.getIp()).toEqual("192.168.0.10");
    });
  });

  describe("getWebsocketUri()", () => {
    it("should throw error if there is no network node", async () => {
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule));

      expect(() => ctx.getWebsocketUri(80)).toThrow(new Error("There is no network in this work context"));
    });

    it("should return websocket URI from the NetworkNode", async () => {
      const mockNode = mock(NetworkNode);

      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
        networkNode: instance(mockNode),
      });

      when(mockNode.getWebsocketUri(20)).thenReturn("ws://localhost:20");

      expect(ctx.getWebsocketUri(20)).toEqual("ws://localhost:20");
    });
  });

  describe("uploadData()", () => {
    it("should execute upload json command", async () => {
      const input = "Hello World";

      const eventDate = new Date().toISOString();

      when(mockExecutor.execute(_, _, _)).thenResolve(
        buildExecutorResults([
          {
            index: 0,
            result: "Ok",
            isBatchFinished: true,
            eventDate,
          },
        ]),
      );

      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
        storageProvider: instance(mockStorageProvider),
      });

      const result = await ctx.uploadData(new TextEncoder().encode(input), "/golem/file.txt");

      expect(result).toEqual(
        expect.objectContaining({
          index: 0,
          result: "Ok",
          isBatchFinished: true,
          eventDate,
        }),
      );
    });
  });

  describe("setupActivity() - called as part of before()", () => {
    it("should call all setup functions in the order they were registered", async () => {
      const calls: string[] = [];
      const activityReadySetupFunctions = [
        async () => calls.push("1"),
        async () => calls.push("2"),
        async () => calls.push("3"),
      ];

      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule), {
        activityReadySetupFunctions,
      });

      await ctx.before();

      expect(calls).toEqual(["1", "2", "3"]);
    });
  });

  describe("Error handling", () => {
    it("should return a result with error in case the command to execute is invalid", async () => {
      const worker = async (ctx: WorkContext) => ctx.beginBatch().run("invalid_shell_command").end();
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule));

      when(mockExecutor.execute(_)).thenResolve(
        buildExecutorResults(undefined, [buildExeScriptErrorResult("error", "Some error occurred")]),
      );
      const [result] = await worker(ctx);

      expect(result.result).toEqual("Error");
      expect(result.message).toEqual("Some error occurred");
    });

    it("should catch error while executing batch as stream with invalid command", async () => {
      const worker = async (ctx: WorkContext) => ctx.beginBatch().run("invalid_shell_command").endStream();
      const ctx = new WorkContext(instance(mockActivity), instance(mockActivityModule));

      when(mockExecutor.execute(_)).thenResolve(
        buildExecutorResults(undefined, [buildExeScriptErrorResult("error", "Some error occurred", "test_result")]),
      );

      const results = await worker(ctx);

      await new Promise((res) =>
        results.once("error", (error: GolemModuleError) => {
          expect(error.message).toEqual("Some error occurred. Stdout: test_result. Stderr: error");
          expect(error).toBeInstanceOf(GolemWorkError);
          expect(error.code).toEqual(WorkErrorCode.ScriptExecutionFailed);
          res(true);
        }),
      );
    });
  });
});
