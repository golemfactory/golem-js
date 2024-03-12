import {
  Activity,
  ActivityStateEnum,
  Agreement,
  GolemModuleError,
  GolemWorkError,
  NetworkNode,
  StorageProvider,
  WorkContext,
  WorkErrorCode,
  YagnaApi,
} from "../../src";
import { anyOfClass, anything, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { LoggerMock } from "../mock/utils/logger";
import { buildExeScriptErrorResult, buildExeScriptSuccessResult, simulateLongPoll } from "./helpers";
import * as YaTsClient from "ya-ts-client";
import { IPv4 } from "ip-num";
import { StorageProviderDataCallback } from "../../src/storage/provider";
import EventEmitter from "events";

const logger = new LoggerMock();

const mockStorageProvider = imock<StorageProvider>();

const mockYagna = mock(YagnaApi);
const mockControl = mock(YaTsClient.ActivityApi.RequestorControlService);
const mockState = mock(YaTsClient.ActivityApi.RequestorStateService);
const mockAgreement = mock(Agreement);

const yagnaApi = instance(mockYagna);

const mockEventSourceEmitter = new EventEmitter();
jest.mock("eventsource", () =>
  jest.fn(() => ({
    addEventListener: (e, cb) => mockEventSourceEmitter.on(e, cb),
    close: () => null,
  })),
);

describe("Work Context", () => {
  beforeEach(() => {
    logger.clear();

    // Make mocks ready to re-use
    reset(mockStorageProvider);
    reset(mockYagna);
    reset(mockControl);
    reset(mockAgreement);

    when(mockYagna.yagnaOptions).thenReturn({
      logger,
      basePath: "http://localhost",
      apiKey: "test-key",
    });

    when(mockYagna.activity).thenReturn({
      state: instance(mockState),
      control: instance(mockControl),
    });

    when(mockControl.createActivity(anything())).thenResolve("activity-id");

    when(mockControl.exec("activity-id", anything())).thenResolve("batch-id");

    when(mockState.getActivityState("activity-id")).thenResolve({
      state: ["Ready", null],
      reason: "",
      errorMessage: "",
    });

    when(mockAgreement.getProviderInfo()).thenReturn({
      id: "provider-id",
      name: "Test Provider",
      walletAddress: "0x123",
    });
  });

  const commonWorkOptions = {
    yagnaOptions: yagnaApi.yagnaOptions,
    logger,
    activityStateCheckingInterval: 10,
    storageProvider: instance(mockStorageProvider),
  };

  const agreement = instance(mockAgreement);

  describe("Executing", () => {
    it("should execute run command with a single parameter", async () => {
      const activity = await Activity.create(agreement, yagnaApi);

      when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenCall(() =>
        simulateLongPoll([
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
      const ctx = new WorkContext(activity, commonWorkOptions);
      await ctx.before();
      const results = await worker(ctx);
      expect(results?.stdout).toEqual("test_result");
    });

    it("should execute run command with multiple parameters", async () => {
      const activity = await Activity.create(agreement, yagnaApi);

      when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenCall(() =>
        simulateLongPoll([
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
      const ctx = new WorkContext(activity, commonWorkOptions);
      await ctx.before();
      const results = await worker(ctx);

      expect(results?.stdout).toEqual("test_result_from_ls");
    });

    describe("upload commands", () => {
      it("should execute upload file command", async () => {
        const activity = await Activity.create(agreement, yagnaApi);
        const worker = async (ctx: WorkContext) => ctx.uploadFile("./file.txt", "/golem/file.txt");

        when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenCall(() =>
          simulateLongPoll([
            {
              index: 0,
              eventDate: new Date().toISOString(),
              result: "Ok",
              stdout: "test_result",
              isBatchFinished: true,
            },
          ]),
        );

        const ctx = new WorkContext(activity, commonWorkOptions);
        await ctx.before();
        const results = await worker(ctx);
        expect(results?.stdout).toEqual("test_result");
        verify(mockStorageProvider.publishFile("./file.txt")).once();
      });

      it("should execute upload json command", async () => {
        const activity = await Activity.create(agreement, yagnaApi);
        const worker = async (ctx: WorkContext) => ctx.uploadJson({ test: true }, "/golem/file.txt");

        when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenCall(() =>
          simulateLongPoll([
            {
              index: 0,
              eventDate: new Date().toISOString(),
              result: "Ok",
              stdout: "test_result",
              isBatchFinished: true,
            },
          ]),
        );

        const ctx = new WorkContext(activity, commonWorkOptions);
        await ctx.before();
        const results = await worker(ctx);

        expect(results?.stdout).toEqual("test_result");
        verify(mockStorageProvider.publishData(anyOfClass(Uint8Array))).once();
      });
    });

    describe("download commands", () => {
      it("should execute download file command", async () => {
        const activity = await Activity.create(agreement, yagnaApi);
        const worker = async (ctx: WorkContext) => ctx.downloadFile("/golem/file.txt", "./file.txt");

        when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenCall(() =>
          simulateLongPoll([
            {
              index: 0,
              eventDate: new Date().toISOString(),
              result: "Ok",
              stdout: "test_result",
              isBatchFinished: true,
            },
          ]),
        );

        const ctx = new WorkContext(activity, commonWorkOptions);

        await ctx.before();
        const results = await worker(ctx);

        expect(results?.stdout).toEqual("test_result");
        verify(mockStorageProvider.receiveFile("./file.txt")).once();
      });

      it("should execute download json command", async () => {
        const json = { hello: "World" };
        const jsonStr = JSON.stringify(json);
        const encoded = new TextEncoder().encode(jsonStr);
        const activity = await Activity.create(agreement, yagnaApi);

        when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenCall(() =>
          simulateLongPoll([
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

        const ctx = new WorkContext(activity, commonWorkOptions);
        const result = await ctx.downloadJson("/golem/file.txt");

        expect(result.result).toEqual("Ok");
        expect(result.data).toEqual(json);
      });

      it("should execute download data command", async () => {
        const data = new Uint8Array(10);
        const activity = await Activity.create(agreement, yagnaApi);

        const eventDate = new Date().toISOString();

        when(mockStorageProvider.receiveData(anything())).thenResolve(data.toString());

        when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenCall(() =>
          simulateLongPoll([
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

        const ctx = new WorkContext(activity, commonWorkOptions);
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
      const activity = await Activity.create(agreement, yagnaApi);
      const ctx = new WorkContext(activity, commonWorkOptions);
      const remote = await ctx.runAndStream("rm -rf foo/");
      const mockedEvents = [
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":0,"timestamp":"2022-06-23T10:42:38.626573153","kind":{"stdout":"{\\"startMode\\":\\"blocking\\",\\"valid\\":{\\"Ok\\":\\"\\"},\\"vols\\":[]}"}}',
        },
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":0,"timestamp":"2022-06-23T10:42:38.626958777","kind":{"finished":{"return_code":0,"message":null}}}',
        },
      ];
      mockedEvents.forEach((ev) => mockEventSourceEmitter.emit("runtime", ev));

      const finalResult = await remote.waitForExit();
      expect(finalResult.result).toBe("Ok");
    });
  });

  describe("transfer()", () => {
    it("should execute transfer command", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const ctx = new WorkContext(activity, commonWorkOptions);

      when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenCall(() =>
        simulateLongPoll([
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
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => {
        return ctx
          .beginBatch()
          .run("some_shell_command")
          .uploadFile("./file.txt", "/golem/file.txt")
          .uploadJson({ test: true }, "/golem/file.txt")
          .downloadFile("/golem/file.txt", "./file.txt")
          .end();
      };
      const ctx = new WorkContext(activity, commonWorkOptions);
      const expectedStdout = [
        { stdout: "ok_run" },
        { stdout: "ok_upload_file" },
        { stdout: "ok_upload_json" },
        { stdout: "ok_download_file" },
      ];

      when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenResolve(
        expectedStdout.map((e) => buildExeScriptSuccessResult(e.stdout)),
      );

      const results = await worker(ctx);
      expect(results?.map((r) => r.stdout)).toEqual(expectedStdout.map((s) => s.stdout));

      verify(mockStorageProvider.publishFile("./file.txt")).once();
      verify(mockStorageProvider.publishData(anyOfClass(Uint8Array))).once();
      verify(mockStorageProvider.receiveFile("./file.txt")).once();
    });

    it("should execute batch as stream", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => {
        return ctx
          .beginBatch()
          .run("some_shell_command")
          .uploadFile("./file.txt", "/golem/file.txt")
          .uploadJson({ test: true }, "/golem/file.txt")
          .downloadFile("/golem/file.txt", "./file.txt")
          .endStream();
      };
      const ctx = new WorkContext(activity, commonWorkOptions);
      const expectedStdout = [
        { stdout: "ok_run" },
        { stdout: "ok_upload_file" },
        { stdout: "ok_upload_json" },
        { stdout: "ok_download_file" },
      ];

      when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenResolve(
        expectedStdout.map((e) => buildExeScriptSuccessResult(e.stdout)),
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

  describe("getState() helper function", () => {
    it("should return activity state", async () => {
      const mActivity = mock(Activity);
      when(mActivity.getState()).thenResolve(ActivityStateEnum.Deployed);
      when(mActivity.agreement).thenReturn(instance(mockAgreement));

      const ctx = new WorkContext(instance(mActivity), commonWorkOptions);
      await expect(ctx.getState()).resolves.toEqual(ActivityStateEnum.Deployed);
    });
  });

  describe("getIp()", () => {
    it("should throw error if there is no network node", async () => {
      const activity = await Activity.create(instance(mockAgreement), yagnaApi);
      const ctx = new WorkContext(activity, commonWorkOptions);

      expect(() => ctx.getIp()).toThrow(new Error("There is no network in this work context"));
    });

    it("should return ip address of provider vpn network node", async () => {
      const activity = await Activity.create(instance(mockAgreement), yagnaApi);
      const networkNode = new NetworkNode(
        "test-node",
        IPv4.fromString("192.168.0.10"),
        () => ({
          id: "test-network",
          ip: "192.168.0.0/24",
          nodes: {
            "192.168.0.10": "example-provider-id",
          },
          mask: "255.255.255.0",
        }),
        "http://localhost",
      );

      const ctx = new WorkContext(activity, {
        ...commonWorkOptions,
        networkNode,
      });

      expect(ctx.getIp()).toEqual("192.168.0.10");
    });
  });

  describe("getWebsocketUri()", () => {
    it("should throw error if there is no network node", async () => {
      const activity = await Activity.create(instance(mockAgreement), yagnaApi);
      const ctx = new WorkContext(activity, commonWorkOptions);

      expect(() => ctx.getWebsocketUri(80)).toThrow(new Error("There is no network in this work context"));
    });

    it("should return websocket URI from the NetworkNode", async () => {
      const activity = await Activity.create(instance(mockAgreement), yagnaApi);
      const mockNode = mock(NetworkNode);

      const ctx = new WorkContext(activity, {
        ...commonWorkOptions,
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

      when(mockControl.getExecBatchResults("activity-id", "batch-id", anything(), anything())).thenCall(() =>
        simulateLongPoll([
          {
            index: 0,
            result: "Ok",
            isBatchFinished: true,
            eventDate,
          },
        ]),
      );

      const activity = await Activity.create(instance(mockAgreement), yagnaApi);
      const ctx = new WorkContext(activity, commonWorkOptions);

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
      const activity = await Activity.create(instance(mockAgreement), yagnaApi);

      const calls: string[] = [];
      const activityReadySetupFunctions = [
        async () => calls.push("1"),
        async () => calls.push("2"),
        async () => calls.push("3"),
      ];

      const ctx = new WorkContext(activity, {
        ...commonWorkOptions,
        activityReadySetupFunctions,
      });

      await ctx.before();

      expect(calls).toEqual(["1", "2", "3"]);
    });
  });

  describe("Error handling", () => {
    it("should return a result with error in case the command to execute is invalid", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => ctx.beginBatch().run("invalid_shell_command").end();
      const ctx = new WorkContext(activity, commonWorkOptions);

      when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenResolve([
        buildExeScriptErrorResult("error", "Some error occurred"),
      ]);

      const [result] = await worker(ctx);

      expect(result.result).toEqual("Error");
      expect(result.message).toEqual("Some error occurred");
    });

    it("should catch error while executing batch as stream with invalid command", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const worker = async (ctx: WorkContext) => ctx.beginBatch().run("invalid_shell_command").endStream();
      const ctx = new WorkContext(activity, commonWorkOptions);

      when(mockControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenCall(() =>
        simulateLongPoll([buildExeScriptErrorResult("error", "Some error occurred", "test_result")]),
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
