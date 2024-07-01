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
  ExeUnit,
  WorkErrorCode,
  YagnaExeScriptObserver,
} from "../../index";
import { _, anyOfClass, anything, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import {
  buildExecutorResults,
  buildExeScriptErrorResult,
  buildExeScriptSuccessResult,
} from "../../../tests/utils/helpers";
import { StorageProviderDataCallback } from "../../shared/storage/provider";
import { ActivityApi } from "ya-ts-client";
import { ExeScriptExecutor } from "../exe-script-executor";
import { INetworkApi } from "../../network/api";

const mockActivityApi = imock<IActivityApi>();
const mockNetworkApi = imock<INetworkApi>();
const mockActivity = mock(Activity);
const mockExecutor = mock(ExeScriptExecutor);
const mockActivityControl = imock<ActivityApi.RequestorControlService>();
const mockExecObserver = imock<YagnaExeScriptObserver>();
const mockStorageProvider = imock<StorageProvider>();
const mockAgreement = mock(Agreement);
const mockActivityModule = imock<ActivityModule>();

describe("ExeUnit", () => {
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
      when(mockExecutor.getResultsObservable(_, _, _, _)).thenReturn(
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

      const worker = async (exe: ExeUnit) => exe.run("some_shell_command");
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule));
      await exe.setup();
      const results = await worker(exe);
      expect(results?.stdout).toEqual("test_result");
    });

    it("should execute run command with multiple parameters", async () => {
      when(mockExecutor.getResultsObservable(_, _, _, _)).thenReturn(
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

      const worker = async (exe: ExeUnit) => exe.run("/bin/ls", ["-R"]);
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule));
      await exe.setup();
      const results = await worker(exe);

      expect(results?.stdout).toEqual("test_result_from_ls");
    });

    describe("upload commands", () => {
      it("should execute upload file command", async () => {
        const worker = async (exe: ExeUnit) => exe.uploadFile("./file.txt", "/golem/file.txt");

        when(mockExecutor.getResultsObservable(_, _, _, _)).thenReturn(
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

        const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), {
          storageProvider: instance(mockStorageProvider),
        });
        await exe.setup();
        const results = await worker(exe);
        expect(results?.stdout).toEqual("test_result");
        verify(mockStorageProvider.publishFile("./file.txt")).once();
      });

      it("should execute upload json command", async () => {
        const worker = async (exe: ExeUnit) => exe.uploadJson({ test: true }, "/golem/file.txt");

        when(mockExecutor.getResultsObservable(_, _, _, _)).thenReturn(
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

        const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), {
          storageProvider: instance(mockStorageProvider),
        });
        await exe.setup();
        const results = await worker(exe);

        expect(results?.stdout).toEqual("test_result");
        verify(mockStorageProvider.publishData(anyOfClass(Uint8Array))).once();
      });
    });

    describe("download commands", () => {
      it("should execute download file command", async () => {
        const worker = async (exe: ExeUnit) => exe.downloadFile("/golem/file.txt", "./file.txt");

        when(mockExecutor.getResultsObservable(_, _, _, _)).thenReturn(
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

        const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), {
          storageProvider: instance(mockStorageProvider),
        });

        await exe.setup();
        const results = await worker(exe);

        expect(results?.stdout).toEqual("test_result");
        verify(mockStorageProvider.receiveFile("./file.txt")).once();
      });

      it("should execute download json command", async () => {
        const json = { hello: "World" };
        const jsonStr = JSON.stringify(json);
        const encoded = new TextEncoder().encode(jsonStr);

        when(mockExecutor.getResultsObservable(_, _, _, _)).thenReturn(
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

        const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), {
          storageProvider: instance(mockStorageProvider),
        });
        const result = await exe.downloadJson("/golem/file.txt");

        expect(result.result).toEqual("Ok");
        expect(result.data).toEqual(json);
      });

      it("should execute download data command", async () => {
        const data = new Uint8Array(10);

        const eventDate = new Date().toISOString();

        when(mockStorageProvider.receiveData(anything())).thenResolve(data.toString());

        when(mockExecutor.getResultsObservable(_, _, _, _)).thenReturn(
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

        const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), {
          storageProvider: instance(mockStorageProvider),
        });
        const result = await exe.downloadData("/golem/file.txt");

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
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule));
      when(mockExecutor.getResultsObservable(_, _, _, _)).thenReturn(
        buildExecutorResults([
          {
            index: 0,
            eventDate: new Date().toISOString(),
            result: "Ok",
            isBatchFinished: true,
          },
        ]),
      );
      const remote = await exe.runAndStream("rm -rf foo/");

      const finalResult = await remote.waitForExit();
      expect(finalResult.result).toBe("Ok");
    });
  });

  describe("transfer()", () => {
    it("should execute transfer command", async () => {
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule));

      when(mockExecutor.getResultsObservable(_, _, _, _)).thenReturn(
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

      const remote = await exe.transfer("http://golem.network/test.txt", "/golem/work/test.txt");
      expect(remote.result).toEqual("Ok");
    });
  });

  describe("Batch", () => {
    it("should execute batch as promise", async () => {
      const worker = async (exe: ExeUnit) => {
        return exe
          .beginBatch()
          .run("some_shell_command")
          .uploadFile("./file.txt", "/golem/file.txt")
          .uploadJson({ test: true }, "/golem/file.txt")
          .downloadFile("/golem/file.txt", "./file.txt")
          .end();
      };
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), {
        storageProvider: instance(mockStorageProvider),
      });
      const expectedStdout = [
        { stdout: "ok_run" },
        { stdout: "ok_upload_file" },
        { stdout: "ok_upload_json" },
        { stdout: "ok_download_file" },
      ];

      when(mockExecutor.getResultsObservable(_)).thenReturn(
        buildExecutorResults(expectedStdout.map((e) => buildExeScriptSuccessResult(e.stdout))),
      );

      const results = await worker(exe);
      expect(results?.map((r) => r.stdout)).toEqual(expectedStdout.map((s) => s.stdout));

      verify(mockStorageProvider.publishFile("./file.txt")).once();
      verify(mockStorageProvider.publishData(anyOfClass(Uint8Array))).once();
      verify(mockStorageProvider.receiveFile("./file.txt")).once();
    });

    it("should execute batch as stream", async () => {
      const worker = async (exe: ExeUnit) => {
        return exe
          .beginBatch()
          .run("some_shell_command")
          .uploadFile("./file.txt", "/golem/file.txt")
          .uploadJson({ test: true }, "/golem/file.txt")
          .downloadFile("/golem/file.txt", "./file.txt")
          .endStream();
      };
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), {
        storageProvider: instance(mockStorageProvider),
      });
      const expectedStdout = [
        { stdout: "ok_run" },
        { stdout: "ok_upload_file" },
        { stdout: "ok_upload_json" },
        { stdout: "ok_download_file" },
      ];

      when(mockExecutor.getResultsObservable(_)).thenReturn(
        buildExecutorResults(expectedStdout.map((e) => buildExeScriptSuccessResult(e.stdout))),
      );

      const results = await worker(exe);
      await new Promise<void>((res, rej) => {
        results.subscribe({
          next: (result) => {
            try {
              expect(result.stdout).toEqual(expectedStdout?.shift()?.stdout);
            } catch (e) {
              rej(e);
            }
          },
          complete: () => res(),
        });
      });

      verify(mockStorageProvider.publishFile("./file.txt")).once();
      verify(mockStorageProvider.publishData(anyOfClass(Uint8Array))).once();
      verify(mockStorageProvider.receiveFile("./file.txt")).once();
    });
  });

  describe("fetchState() helper function", () => {
    it("should return activity state", async () => {
      when(mockActivity.getState()).thenReturn(ActivityStateEnum.Deployed);
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule));
      await expect(exe["fetchState"]()).resolves.toEqual(ActivityStateEnum.Deployed);
    });
  });

  describe("getIp()", () => {
    it("should throw error if there is no network node", async () => {
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule));

      expect(() => exe.getIp()).toThrow(new Error("There is no network in this exe-unit"));
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
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), {
        networkNode,
      });

      expect(exe.getIp()).toEqual("192.168.0.10");
    });
  });

  describe("getWebsocketUri()", () => {
    it("should throw error if there is no network node", async () => {
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule));

      expect(() => exe.getWebsocketUri(80)).toThrow(new Error("There is no network in this exe-unit"));
    });

    it("should return websocket URI from the NetworkNode", async () => {
      const mockNode = mock(NetworkNode);

      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), {
        networkNode: instance(mockNode),
      });

      when(mockNode.getWebsocketUri(20)).thenReturn("ws://localhost:20");

      expect(exe.getWebsocketUri(20)).toEqual("ws://localhost:20");
    });
  });

  describe("uploadData()", () => {
    it("should execute upload json command", async () => {
      const input = "Hello World";

      const eventDate = new Date().toISOString();

      when(mockExecutor.getResultsObservable(_, _, _, _)).thenReturn(
        buildExecutorResults([
          {
            index: 0,
            result: "Ok",
            isBatchFinished: true,
            eventDate,
          },
        ]),
      );

      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), {
        storageProvider: instance(mockStorageProvider),
      });

      const result = await exe.uploadData(new TextEncoder().encode(input), "/golem/file.txt");

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
    it("should call setup function", async () => {
      const setup = jest.fn();
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule), { setup });
      await exe.setup();
      expect(setup).toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should return a result with error in case the command to execute is invalid", async () => {
      const worker = async (exe: ExeUnit) => exe.beginBatch().run("invalid_shell_command").end();
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule));

      when(mockExecutor.getResultsObservable(_)).thenReturn(
        buildExecutorResults(undefined, [buildExeScriptErrorResult("error", "Some error occurred")]),
      );
      const [result] = await worker(exe);

      expect(result.result).toEqual("Error");
      expect(result.message).toEqual("Some error occurred");
    });

    it("should catch error while executing batch as stream with invalid command", async () => {
      const worker = async (exe: ExeUnit) => exe.beginBatch().run("invalid_shell_command").endStream();
      const exe = new ExeUnit(instance(mockActivity), instance(mockActivityModule));

      when(mockExecutor.getResultsObservable(_)).thenReturn(
        buildExecutorResults(undefined, [buildExeScriptErrorResult("error", "Some error occurred", "test_result")]),
      );

      const results = await worker(exe);

      await new Promise((res) =>
        results.subscribe({
          error: (error: GolemModuleError) => {
            expect(error.message).toEqual("Some error occurred. Stdout: test_result. Stderr: error");
            expect(error).toBeInstanceOf(GolemWorkError);
            expect(error.code).toEqual(WorkErrorCode.ScriptExecutionFailed);
            res(true);
          },
        }),
      );
    });
  });
});
