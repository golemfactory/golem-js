import {
  Activity,
  ActivityStateEnum,
  Agreement,
  GolemError,
  GolemTimeoutError,
  GolemWorkError,
  StorageProvider,
  WorkErrorCode,
  YagnaApi,
} from "../../src";
import { sleep } from "../../src/utils";
import { Capture, Deploy, DownloadFile, Run, Script, Start, Terminate, UploadFile } from "../../src/script";
import { anything, imock, instance, mock, reset, spy, verify, when } from "@johanblumenberg/ts-mockito";
import * as YaTsClient from "ya-ts-client";
import { buildExeScriptSuccessResult } from "./helpers";
import EventEmitter from "events";

const mockEventSourceEmitter = new EventEmitter();
jest.mock("eventsource", () =>
  jest.fn(() => ({
    addEventListener: (e, cb) => mockEventSourceEmitter.on(e, cb),
    close: () => null,
  })),
);

const mockYagna = mock(YagnaApi);
const mockAgreement = mock(Agreement);
const mockActivityControl = mock(YaTsClient.ActivityApi.RequestorControlService);
const mockActivityState = mock(YaTsClient.ActivityApi.RequestorStateService);
const mockStorageProvider = imock<StorageProvider>();

describe("Activity", () => {
  beforeEach(() => {
    reset(mockYagna);
    reset(mockAgreement);
    reset(mockActivityControl);
    reset(mockActivityState);

    when(mockYagna.yagnaOptions).thenReturn({
      apiKey: "some-api-key",
      basePath: "http://localhost",
    });

    when(mockYagna.activity).thenReturn({
      state: instance(mockActivityState),
      control: instance(mockActivityControl),
    });

    when(mockActivityControl.createActivity(anything())).thenResolve({
      activityId: "activity-id",
    });

    when(mockAgreement.getProviderInfo()).thenReturn({
      id: "provider-id",
      name: "Test Provider",
      walletAddress: "0xTestProvider",
    });
  });
  describe("Creating", () => {
    it("should create activity", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      expect(activity).toBeInstanceOf(Activity);
    });
  });

  describe("Executing", () => {
    it("should execute commands on activity", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));

      when(mockActivityControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenResolve([
        {
          isBatchFinished: true,
          result: "Ok",
          stdout: "Done",
          stderr: "",
          index: 1,
          eventDate: new Date().toISOString(),
        },
      ]);

      const streamResult = await activity.execute(new Deploy().toExeScriptRequest());

      const { value: result } = await streamResult[Symbol.asyncIterator]().next();

      expect(result.result).toEqual("Ok");
    });

    it("should execute commands and get state", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));

      when(mockActivityControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenResolve([
        {
          isBatchFinished: true,
          result: "Ok",
          stdout: "Done",
          stderr: "",
          index: 1,
          eventDate: new Date().toISOString(),
        },
      ]);

      const streamResult = await activity.execute(new Run("test_command").toExeScriptRequest());

      when(mockActivityState.getActivityState(anything())).thenResolve({
        state: [ActivityStateEnum.Ready, null],
      });

      const { value: result } = await streamResult[Symbol.asyncIterator]().next();
      const stateAfterRun = await activity.getState();

      expect(result.result).toEqual("Ok");
      expect(stateAfterRun).toEqual(ActivityStateEnum.Ready);
    });

    it("should execute script and get results by iterator", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const command4 = new Run("test_command2");
      const command5 = new Terminate();
      const script = Script.create([command1, command2, command3, command4, command5]);

      when(mockActivityControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenResolve([
        buildExeScriptSuccessResult("test"),
        buildExeScriptSuccessResult("test"),
        buildExeScriptSuccessResult("stdout_test_command_run_1"),
        buildExeScriptSuccessResult("stdout_test_command_run_2"),
        buildExeScriptSuccessResult("test"),
      ]);

      const expectedRunStdOuts = ["test", "test", "stdout_test_command_run_1", "stdout_test_command_run_2", "test"];
      await script.before();
      const results = await activity.execute(script.getExeScriptRequest());

      for await (const result of results) {
        expect(result.result).toEqual("Ok");
        expect(result.stdout).toEqual(expectedRunStdOuts.shift());
      }

      await script.after([]);
      await activity.stop();
    });

    it("should execute script and get results by events", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new UploadFile(instance(mockStorageProvider), "testSrc", "testDst");
      const command4 = new Run("test_command1");
      const command5 = new DownloadFile(instance(mockStorageProvider), "testSrc", "testDst");
      const command6 = new Terminate();
      const script = Script.create([command1, command2, command3, command4, command5, command6]);

      when(mockActivityControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenResolve([
        buildExeScriptSuccessResult("test"),
        buildExeScriptSuccessResult("test"),
        buildExeScriptSuccessResult("stdout_test_command_run_1"),
        buildExeScriptSuccessResult("stdout_test_command_run_2"),
        buildExeScriptSuccessResult("test"),
        buildExeScriptSuccessResult("test"),
      ]);

      const expectedRunStdOuts = [
        "test",
        "test",
        "stdout_test_command_run_1",
        "stdout_test_command_run_2",
        "test",
        "test",
      ];
      await script.before();
      const results = await activity.execute(script.getExeScriptRequest());
      let resultCount = 0;
      return new Promise<void>((res) => {
        results.on("data", (result) => {
          expect(result.result).toEqual("Ok");
          expect(result.stdout).toEqual(expectedRunStdOuts.shift());
          ++resultCount;
        });
        results.on("end", async () => {
          await script.after([]);
          await activity.stop();
          expect(resultCount).toEqual(6);
          return res();
        });
      });
    });

    it("should execute script by streaming batch", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      const command1 = new Deploy();
      const command2 = new Start();
      const capture: Capture = {
        stdout: { stream: { format: "string" } },
        stderr: { stream: { format: "string" } },
      };
      const command3 = new Run("test_command1", null, null, capture);
      const command4 = new Terminate();
      const script = Script.create([command1, command2, command3, command4]);
      const mockedEvents = [
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":0,"timestamp":"2022-06-23T10:42:38.626573153","kind":{"stdout":"{\\"startMode\\":\\"blocking\\",\\"valid\\":{\\"Ok\\":\\"\\"},\\"vols\\":[]}"}}',
        },
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":0,"timestamp":"2022-06-23T10:42:38.626958777","kind":{"finished":{"return_code":0,"message":null}}}',
        },
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":1,"timestamp":"2022-06-23T10:42:38.626960850","kind":{"started":{"command":{"start":{"args":[]}}}}}',
        },
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":1,"timestamp":"2022-06-23T10:42:39.946031527","kind":{"finished":{"return_code":0,"message":null}}}',
        },
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":2,"timestamp":"2022-06-23T10:42:39.946034161","kind":{"started":{"command":{"run":{"entry_point":"/bin/sh","args":["-c","echo +\\"test\\""],"capture":{"stdout":{"stream":{"format":"str"}},"stderr":{"stream":{"format":"str"}}}}}}}}',
        },
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":2,"timestamp":"2022-06-23T10:42:39.957927713","kind":{"stdout":"test"}}',
        },
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":2,"timestamp":"2022-06-23T10:42:39.958238754","kind":{"finished":{"return_code":0,"message":null}}}',
        },
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":3,"timestamp":"2022-06-23T10:42:39.962014674","kind":{"started":{"command":{"terminate":{}}}}}',
        },
        {
          type: "runtime",
          data: '{"batch_id":"04a9b0f49e564db99e6f15ba95c35817","index":3,"timestamp":"2022-06-23T10:42:40.009603540","kind":{"finished":{"return_code":0,"message":null}}}',
        },
      ];
      await script.before();
      const results = await activity.execute(script.getExeScriptRequest(), true);
      mockedEvents.forEach((ev) => mockEventSourceEmitter.emit("runtime", ev));
      let expectedStdout;
      for await (const result of results) {
        expect(result).toHaveProperty("index");
        if (result.index === 2 && result.stdout) expectedStdout = result.stdout;
      }
      expect(expectedStdout).toEqual("test");
      await script.after([]);
      await activity.stop();
    });
  });

  describe("Getting state", () => {
    it("should get activity state", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      when(mockActivityState.getActivityState(anything())).thenResolve({
        state: [ActivityStateEnum.Ready, ActivityStateEnum.Terminated],
      });
      const state = await activity.getState();
      expect(state).toEqual(ActivityStateEnum.Ready);
    });
  });

  describe("Cancelling", () => {
    it("should cancel activity", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const command4 = new Run("test_command2");
      const command5 = new Run("test_command3");
      const command6 = new Terminate();
      const script = Script.create([command1, command2, command3, command4, command5, command6]);
      await script.before();
      const results = await activity.execute(script.getExeScriptRequest(), undefined, undefined);
      await activity.stop();
      return new Promise<void>((res) => {
        results.on("error", (error) => {
          expect(error.toString()).toMatch(/Error: Activity .* has been interrupted/);
          return res();
        });
        results.on("data", () => null);
      });
    });

    it("should cancel activity while streaming batch", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      const command1 = new Deploy();
      const command2 = new Start();
      const capture: Capture = {
        stdout: { stream: { format: "string" } },
        stderr: { stream: { format: "string" } },
      };
      const command3 = new Run("test_command1", null, null, capture);
      const command4 = new Terminate();
      const script = Script.create([command1, command2, command3, command4]);
      await script.before();
      const results = await activity.execute(script.getExeScriptRequest(), true, undefined);
      await activity.stop();
      return new Promise<void>((res) => {
        results.on("error", (error) => {
          expect(error.toString()).toMatch(/Error: Activity .* has been interrupted/);
          return res();
        });
        results.on("data", () => null);
      });
    });
  });

  describe("Error handling", () => {
    it("should handle some error", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const script = Script.create([command1, command2, command3]);
      const results = await activity.execute(script.getExeScriptRequest(), false, 200, 0);

      const error = new Error("Some undefined error");

      when(mockActivityControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenReject(error);

      return new Promise<void>((res) => {
        results.on("error", (error: GolemWorkError) => {
          expect(error).toBeInstanceOf(GolemWorkError);
          expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
          expect(error.getActivity()).toBeDefined();
          expect(error.getAgreement()).toBeDefined();
          expect(error.getProvider()?.name).toEqual("Test Provider");
          expect(error.previous?.toString()).toEqual(
            "Error: Failed to fetch activity results. Attempt: 1. Error: Some undefined error",
          );
          expect(error.toString()).toEqual(
            "Error: Unable to get activity results. Failed to fetch activity results. Attempt: 1. Error: Some undefined error",
          );
          return res();
        });
        results.on("data", (data) => null);
      });
    });

    it("should handle non-retryable error", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna), {
        activityExeBatchResultPollIntervalSeconds: 10,
      });
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const script = Script.create([command1, command2, command3]);
      const results = await activity.execute(script.getExeScriptRequest(), false, 1_000, 3);

      const error = {
        message: "non-retryable error",
        status: 500,
        toString: () => `Error: non-retryable error`,
      };

      when(mockActivityControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenReject(error);

      return new Promise<void>((res) => {
        results.on("error", (error: GolemWorkError) => {
          expect(error).toBeInstanceOf(GolemWorkError);
          expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
          expect(error.getActivity()).toBeDefined();
          expect(error.getAgreement()).toBeDefined();
          expect(error.getProvider()?.name).toEqual("Test Provider");
          expect(error.previous?.toString()).toEqual(
            "Error: Failed to fetch activity results. Attempt: 1. Error: non-retryable error",
          );
          return res();
        });
        results.on("data", () => null);
      });
    });

    it("should retry when a retryable error occurs", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna), {
        activityExeBatchResultPollIntervalSeconds: 10,
      });
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const script = Script.create([command1, command2, command3]);

      const error = {
        message: "timeout",
        status: 408,
        toString: () => `Error: timeout`,
      };
      const testResult = {
        isBatchFinished: true,
        result: "Ok" as "Ok" | "Error",
        stdout: "Done",
        stderr: "",
        index: 1,
        eventDate: new Date().toISOString(),
      };
      when(mockActivityControl.getExecBatchResults(anything(), anything(), anything(), anything()))
        .thenReject(error)
        .thenReject(error)
        .thenResolve([testResult]);

      const results = await activity.execute(script.getExeScriptRequest(), false, 1_000, 10);

      for await (const result of results) {
        expect(result).toEqual(testResult);
      }
      verify(mockActivityControl.getExecBatchResults(anything(), anything(), anything(), anything())).times(3);
    }, 7_000);

    it("should handle termination error", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const script = Script.create([command1, command2, command3]);
      const results = await activity.execute(script.getExeScriptRequest());
      const error = {
        message: "GSB error: endpoint address not found. Terminated.",
        status: 500,
      };

      when(mockActivityControl.getExecBatchResults(anything(), anything(), anything(), anything())).thenReject(error);
      when(mockActivityState.getActivityState(anything())).thenResolve({
        state: [ActivityStateEnum.Terminated, ActivityStateEnum.Terminated],
      });

      return new Promise<void>((res) => {
        results.on("error", (error: GolemWorkError) => {
          expect(error).toBeInstanceOf(GolemWorkError);
          expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
          expect(error.getActivity()).toBeDefined();
          expect(error.getAgreement()).toBeDefined();
          expect(error.getProvider()?.name).toEqual("Test Provider");
          expect(error.previous?.message).toEqual("GSB error: endpoint address not found. Terminated.");
          expect(error.toString()).toEqual(
            "Error: Unable to get activity results. GSB error: endpoint address not found. Terminated.",
          );
          return res();
        });
        results.on("data", () => null);
      });
    });

    it("should handle timeout error", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const command4 = new Run("test_command2");
      const command5 = new Run("test_command3");
      const script = Script.create([command1, command2, command3, command4, command5]);
      const results = await activity.execute(script.getExeScriptRequest(), false, 1);
      await sleep(10, true);
      return new Promise<void>((res) => {
        results.on("error", (error: GolemWorkError) => {
          expect(error).toBeInstanceOf(GolemTimeoutError);
          expect(error.toString()).toMatch(/Error: Activity .* timeout/);
          return res();
        });
        // results.on("end", () => rej());
        results.on("data", () => null);
      });
    });

    it("should handle timeout error while streaming batch", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna), {
        activityExecuteTimeout: 1,
      });
      const command1 = new Deploy();
      const command2 = new Start();
      const capture: Capture = {
        stdout: { stream: { format: "string" } },
        stderr: { stream: { format: "string" } },
      };
      const command3 = new Run("test_command1", null, null, capture);
      const command4 = new Terminate();
      const script = Script.create([command1, command2, command3, command4]);
      await script.before();
      const results = await activity.execute(script.getExeScriptRequest(), true, 800);
      return new Promise<void>((res, rej) => {
        results.on("error", (error: GolemError) => {
          expect(error).toBeInstanceOf(GolemTimeoutError);
          expect(error.toString()).toMatch(/Error: Activity .* timeout/);
          return res();
        });
        results.on("end", () => rej());
        results.on("data", () => null);
      });
    });

    it("should handle some error while streaming batch", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      const command1 = new Deploy();
      const command2 = new Start();
      const capture: Capture = {
        stdout: { stream: { format: "string" } },
        stderr: { stream: { format: "string" } },
      };
      const command3 = new Run("test_command1", null, null, capture);
      const command4 = new Terminate();
      const script = Script.create([command1, command2, command3, command4]);
      const mockedErrorEvents: Partial<MessageEvent>[] = [
        {
          data: {
            type: "error",
            message: "Some undefined error",
          },
        },
      ];
      await script.before();
      const results = await activity.execute(script.getExeScriptRequest(), true);
      mockedErrorEvents.forEach((er) => mockEventSourceEmitter.emit("error", er));
      return new Promise<void>((res) => {
        results.on("error", (error: GolemWorkError) => {
          expect(error).toBeInstanceOf(GolemWorkError);
          expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
          expect(error.getActivity()).toBeDefined();
          expect(error.getAgreement()).toBeDefined();
          expect(error.getProvider()?.name).toEqual("Test Provider");
          expect(error.toString()).toEqual('Error: Unable to get activity results. ["Some undefined error"]');
          return res();
        });
        results.on("data", () => null);
      });
    });
  });

  describe("Destroying", () => {
    it("should stop activity", async () => {
      const activity = await Activity.create(instance(mockAgreement), instance(mockYagna));
      expect(await activity.stop()).toEqual(true);
    });
  });
});
