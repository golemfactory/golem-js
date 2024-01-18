import * as activityMock from "../mock/rest/activity";
import { agreement } from "../mock/entities/agreement";
import { EventSourceMock, setExpectedErrorEvents, setExpectedEvents } from "../mock/utils/event_source";
import { StorageProviderMock, YagnaMock } from "../mock";
import { Activity, ActivityStateEnum } from "../../src/activity";
import { sleep } from "../../src/utils";
import { Deploy, Start, Run, Terminate, UploadFile, DownloadFile, Script, Capture } from "../../src/script";
import { GolemWorkError, WorkErrorCode } from "../../src/task/error";
import { Agreement } from "../../src/agreement";
import { GolemInternalError, GolemTimeoutError } from "../../src/error/golem-error";

jest.mock("eventsource", () => EventSourceMock);
describe("Activity", () => {
  const yagnaApi = new YagnaMock().getApi();
  beforeEach(() => {
    activityMock.clear();
  });

  describe("Creating", () => {
    it("should create activity", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      expect(activity).toBeInstanceOf(Activity);
      const GUID_REGEX =
        /^(?:\{{0,1}(?:[0-9a-fA-F]){8}-(?:[0-9a-fA-F]){4}-(?:[0-9a-fA-F]){4}-(?:[0-9a-fA-F]){4}-(?:[0-9a-fA-F]){12}\}{0,1})$/;
      expect(activity.id).toMatch(GUID_REGEX);
    });
  });

  describe("Executing", () => {
    it("should execute commands on activity", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const streamResult = await activity.execute(new Deploy().toExeScriptRequest());
      const { value: result } = await streamResult[Symbol.asyncIterator]().next();
      expect(result.result).toEqual("Ok");
    });

    it("should execute commands and get state", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const streamResult = await activity.execute(new Run("test_command").toExeScriptRequest());
      const { value: result } = await streamResult[Symbol.asyncIterator]().next();
      activityMock.setExpectedStates([ActivityStateEnum.Ready, null]);
      const stateAfterRun = await activity.getState();
      expect(result.result).toEqual("Ok");
      expect(stateAfterRun).toEqual(ActivityStateEnum.Ready);
    });

    it("should execute script and get results by iterator", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const command4 = new Run("test_command2");
      const command5 = new Terminate();
      const script = Script.create([command1, command2, command3, command4, command5]);
      activityMock.setExpectedExeResults([
        { stdout: "test" },
        { stdout: "test" },
        { stdout: "stdout_test_command_run_1" },
        { stdout: "stdout_test_command_run_2" },
        { stdout: "test" },
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
      const activity = await Activity.create(agreement, yagnaApi);
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new UploadFile(new StorageProviderMock(), "testSrc", "testDst");
      const command4 = new Run("test_command1");
      const command5 = new DownloadFile(new StorageProviderMock(), "testSrc", "testDst");
      const command6 = new Terminate();
      const script = Script.create([command1, command2, command3, command4, command5, command6]);
      activityMock.setExpectedExeResults([
        { stdout: "test" },
        { stdout: "test" },
        { stdout: "stdout_test_command_run_1" },
        { stdout: "stdout_test_command_run_2" },
        { stdout: "test" },
        { stdout: "test" },
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
      const activity = await Activity.create(agreement, yagnaApi);
      const command1 = new Deploy();
      const command2 = new Start();
      const capture: Capture = {
        stdout: { stream: { format: "string" } },
        stderr: { stream: { format: "string" } },
      };
      const command3 = new Run("test_command1", null, null, capture);
      const command4 = new Terminate();
      const script = Script.create([command1, command2, command3, command4]);
      const expectedEvents = [
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
      setExpectedEvents(activity.id, expectedEvents);
      await script.before();
      const results = await activity.execute(script.getExeScriptRequest(), true);
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
      const activity = await Activity.create(agreement, yagnaApi);
      activityMock.setExpectedStates([ActivityStateEnum.Ready, ActivityStateEnum.Terminated]);
      const state = await activity.getState();
      expect(state).toEqual(ActivityStateEnum.Ready);
    });
  });

  describe("Cancelling", () => {
    it("should cancel activity", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
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
      const activity = await Activity.create(agreement, yagnaApi);
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
      const activity = await Activity.create(agreement, yagnaApi);
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const script = Script.create([command1, command2, command3]);
      const results = await activity.execute(script.getExeScriptRequest());
      const error = {
        message: "Some undefined error",
        status: 400,
      };
      activityMock.setExpectedErrors([error, error, error, error, error, error]);
      return new Promise<void>((res) => {
        results.on("error", (error: GolemWorkError) => {
          expect(error).toBeInstanceOf(GolemWorkError);
          expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
          expect(error.activity).toBeDefined();
          expect(error.agreement).toBeDefined();
          expect(error.provider?.name).toEqual("Test Provider");
          expect(error.previous?.toString()).toEqual(
            "Error: Command #0 getExecBatchResults error: Some undefined error",
          );
          expect(error.toString()).toEqual(
            "Error: Unable to get activity results. Command #0 getExecBatchResults error: Some undefined error",
          );
          return res();
        });
        results.on("data", (data) => null);
      });
    });

    it("should handle gsb error", async () => {
      const activity = await Activity.create(agreement, yagnaApi, {
        activityExeBatchResultPollIntervalSeconds: 10,
      });
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const command4 = new Run("test_command1");
      const command5 = new Run("test_command1");
      const command6 = new Run("test_command1");
      const command7 = new Run("test_command1");
      const script = Script.create([command1, command2, command3, command4, command5, command6, command7]);
      const results = await activity.execute(script.getExeScriptRequest());
      const error = {
        message: "GSB error: remote service at `test` error: GSB failure: Bad request: endpoint address not found",
        status: 500,
      };
      activityMock.setExpectedErrors([error, error, error, error, error, error]);
      return new Promise<void>((res) => {
        results.on("error", (error: GolemWorkError) => {
          expect(error).toBeInstanceOf(GolemWorkError);
          expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
          expect(error.activity).toBeDefined();
          expect(error.agreement).toBeDefined();
          expect(error.provider?.name).toEqual("Test Provider");
          expect(error.previous?.toString()).toEqual(
            "Error: Command #0 getExecBatchResults error: GSB error: remote service at `test` error: GSB failure: Bad request: endpoint address not found",
          );
          expect(error.toString()).toEqual(
            "Error: Unable to get activity results. Command #0 getExecBatchResults error: GSB error: remote service at `test` error: GSB failure: Bad request: endpoint address not found",
          );
          return res();
        });
        results.on("data", () => null);
      });
    });

    it("should handle termination error", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const command1 = new Deploy();
      const command2 = new Start();
      const command3 = new Run("test_command1");
      const script = Script.create([command1, command2, command3]);
      const results = await activity.execute(script.getExeScriptRequest());
      const error = {
        message: "GSB error: endpoint address not found. Terminated.",
        status: 500,
      };
      activityMock.setExpectedErrors([error, error, error]);
      activityMock.setExpectedStates([ActivityStateEnum.Terminated, ActivityStateEnum.Terminated]);
      return new Promise<void>((res) => {
        results.on("error", (error: GolemWorkError) => {
          expect(error).toBeInstanceOf(GolemWorkError);
          expect(error.code).toEqual(WorkErrorCode.ActivityResultsFetchingFailed);
          expect(error.activity).toBeDefined();
          expect(error.agreement).toBeDefined();
          expect(error.provider?.name).toEqual("Test Provider");
          expect(error.previous?.toString()).toEqual("Error: GSB error: endpoint address not found. Terminated.");
          expect(error.toString()).toEqual(
            "Error: Unable to get activity results. GSB error: endpoint address not found. Terminated.",
          );
          return res();
        });
        results.on("data", () => null);
      });
    });

    it("should handle timeout error", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
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
      const activity = await Activity.create(agreement, yagnaApi, { activityExecuteTimeout: 1 });
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
        results.on("error", (error) => {
          expect(error.toString()).toMatch(/Error: Activity .* timeout/);
          return res();
        });
        results.on("end", () => rej());
        results.on("data", () => null);
      });
    });

    it("should handle some error while streaming batch", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      const command1 = new Deploy();
      const command2 = new Start();
      const capture: Capture = {
        stdout: { stream: { format: "string" } },
        stderr: { stream: { format: "string" } },
      };
      const command3 = new Run("test_command1", null, null, capture);
      const command4 = new Terminate();
      const script = Script.create([command1, command2, command3, command4]);
      const expectedErrors: Partial<MessageEvent>[] = [
        {
          data: {
            type: "error",
            message: "Some undefined error",
          },
        },
      ];
      setExpectedErrorEvents(activity.id, expectedErrors);
      await script.before();
      const results = await activity.execute(script.getExeScriptRequest(), true);
      return new Promise<void>((res) => {
        results.on("error", (error) => {
          expect(error.toString()).toEqual('Error: Unable to get activity results. ["Some undefined error"]');
          return res();
        });
        results.on("data", () => null);
      });
    });
  });

  describe("Destroying", () => {
    it("should stop activity", async () => {
      const activity = await Activity.create(agreement, yagnaApi);
      expect(await activity.stop()).toEqual(true);
    });
  });
});
