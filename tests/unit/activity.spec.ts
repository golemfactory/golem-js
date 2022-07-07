import test from "ava";
import rewiremock from "rewiremock";
import { RequestorControlApiMock } from "../mock/requestor_control_api";
import { RequestorSateApiMock } from "../mock/requestor_state_api";
rewiremock("ya-ts-client/dist/ya-activity/api").with({
  RequestorControlApi: RequestorControlApiMock,
  RequestorStateApi: RequestorSateApiMock,
});
rewiremock.enable();
import { StorageProviderMock } from "../mock/storage_provider";
import { Activity, ActivityStateEnum, ActivityFactory } from "../../yajsapi/mid-level-api/activity";
import { Deploy, Start, Run, Terminate, SendFile, DownloadFile, Script } from "../../yajsapi/mid-level-api/script";
import { CancellationToken } from "../../yajsapi/mid-level-api/utils";

test("create activity", async (t) => {
  const factory = new ActivityFactory();
  const activity = await factory.create("test_agreement_id");
  t.truthy(activity);
  t.truthy(activity.id);
});

test("execute commands on activity", async (t) => {
  const activity = new Activity("test_id", {});
  const streamResult = await activity.execute(new Deploy().toExeScriptRequest());
  const { value: result } = await streamResult[Symbol.asyncIterator]().next();
  t.is(result.result, "Ok");
});

test("execute commands and get state", async (t) => {
  const activity = new Activity("test_id");
  const streamResult = await activity.execute(new Run("test_command").toExeScriptRequest());
  const { value: result } = await streamResult[Symbol.asyncIterator]().next();
  activity["stateApi"]["setExpected"]("getActivityState", [ActivityStateEnum.Ready, null]);
  const stateAfterRun = await activity.getState();
  t.is(result.result, "Ok");
  t.is(stateAfterRun, ActivityStateEnum.Ready);
});

test("execute script and get results by iterator", async (t) => {
  const activity = new Activity("test_id");
  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new Run("test_command1");
  const command4 = new Run("test_command2");
  const command5 = new Terminate();
  const script = new Script([command1, command2, command3, command4, command5]);
  activity["api"]["setExpectedResult"]([
    ["stdout", "test"],
    ["stdout", "test"],
    ["stdout", "stdout_test_command_run_1"],
    ["stdout", "stdout_test_command_run_2"],
    ["stdout", "test"],
  ]);
  const expectedRunStdOuts = ["test", "test", "stdout_test_command_run_1", "stdout_test_command_run_2", "test"];
  await script.before();
  const results = await activity.execute(script.getExeScriptRequest());
  for await (const result of results) {
    t.is(result.result, "Ok");
    t.is(result.stdout, expectedRunStdOuts.shift());
  }
  await script.after();
  await activity.stop();
});

test("execute script and get results by events", async (t) => {
  const activity = new Activity("test_id");
  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new SendFile(new StorageProviderMock(), "testSrc", "testDst");
  const command4 = new Run("test_command1");
  const command5 = new DownloadFile(new StorageProviderMock(), "testSrc", "testDst");
  const command6 = new Terminate();
  const script = new Script([command1, command2, command3, command4, command5, command6]);
  activity["api"]["setExpectedResult"]([
    ["stdout", "test"],
    ["stdout", "test"],
    ["stdout", "stdout_test_command_run_1"],
    ["stdout", "stdout_test_command_run_2"],
    ["stdout", "test"],
    ["stdout", "test"],
  ]);
  const expectedRunStdOuts = ["test", "test", "stdout_test_command_run_1", "stdout_test_command_run_2", "test", "test"];
  await script.before();
  const results = await activity.execute(script.getExeScriptRequest());
  return new Promise((res) => {
    results.on("data", (result) => {
      t.is(result.result, "Ok");
      t.is(result.stdout, expectedRunStdOuts.shift());
    });
    results.on("end", async () => {
      await script.after();
      await activity.stop();
      return res();
    });
  });
});

test("cancel activity by cancellation token", async (t) => {
  const activity = new Activity("test_id");
  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new Run("test_command1");
  const command4 = new Run("test_command2");
  const command5 = new Run("test_command3");
  const command6 = new Terminate();
  const script = new Script([command1, command2, command3, command4, command5, command6]);
  await script.before();
  const cancellationToken = new CancellationToken();
  const results = await activity.execute(script.getExeScriptRequest(), undefined, undefined, cancellationToken);
  cancellationToken.cancel();
  return new Promise((res) => {
    results.on("error", (error) => {
      t.is(error.toString(), "Error: Activity test_id has been interrupted.");
      return res();
    });
    results.on("data", () => null);
  });
});

test("get activity state", async (t) => {
  const activity = new Activity("test_id");
  activity["stateApi"]["setExpected"]("getActivityState", [ActivityStateEnum.Ready, ActivityStateEnum.Terminated]);
  const state = await activity.getState();
  t.is(state, ActivityStateEnum.Ready);
});

test("stop activity", async (t) => {
  const activity = new Activity("test_id");
  t.is(await activity.stop(), true);
});

test("handle some error", async (t) => {
  const activity = new Activity("test_id");
  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new Run("test_command1");
  const script = new Script([command1, command2, command3]);
  const results = await activity.execute(script.getExeScriptRequest());
  const error = {
    message: "Some undefined error",
    status: 400,
  };
  activity["api"]["setExpectedErrors"]([error, error, error]);
  return new Promise((res) => {
    results.on("error", (error) => {
      t.is(error.toString(), "Error: Some undefined error");
      return res();
    });
    results.on("data", () => null);
  });
});

test("handle gsb error", async (t) => {
  const activity = new Activity("test_id", {
    exeBatchResultsFetchInterval: 10,
  });
  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new Run("test_command1");
  const command4 = new Run("test_command1");
  const command5 = new Run("test_command1");
  const command6 = new Run("test_command1");
  const command7 = new Run("test_command1");
  const script = new Script([command1, command2, command3, command4, command5, command6, command7]);
  const results = await activity.execute(script.getExeScriptRequest());
  const error = {
    message: "GSB error: remote service at `test` error: GSB failure: Bad request: endpoint address not found",
    status: 500,
  };
  activity["api"]["setExpectedErrors"]([error, error, error]);
  return new Promise((res) => {
    results.on("error", (error) => {
      t.is(
        error.toString(),
        "Error: Command #0 getExecBatchResults error: GSB error: remote service at `test` error: GSB failure: Bad request: endpoint address not found"
      );
      return res();
    });
    results.on("data", () => null);
  });
});

test("handle termination error", async (t) => {
  const activity = new Activity("test_id");
  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new Run("test_command1");
  const script = new Script([command1, command2, command3]);
  const results = await activity.execute(script.getExeScriptRequest());
  const error = {
    message: "GSB error: endpoint address not found. Terminated.",
    status: 500,
  };
  activity["api"]["setExpectedErrors"]([error, error, error]);
  activity["stateApi"]["setExpected"]("getActivityState", [ActivityStateEnum.Terminated, ActivityStateEnum.Terminated]);
  return new Promise((res) => {
    results.on("error", (error) => {
      t.is(error.toString(), "Error: GSB error: endpoint address not found. Terminated.");
      return res();
    });
    results.on("data", () => null);
  });
});

test("handle timeout error", async (t) => {
  const activity = new Activity("test_id");
  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new Run("test_command1");
  const script = new Script([command1, command2, command3]);
  const results = await activity.execute(script.getExeScriptRequest(), false, 1);
  const error = {
    message: "Timeout error",
    status: 408,
  };
  activity["api"]["setExpectedErrors"]([error, error]);
  return new Promise((res) => {
    results.on("error", (error) => {
      t.is(error.toString(), "Error: Activity test_id timeout.");
      return res();
    });
    results.on("data", () => null);
  });
});
