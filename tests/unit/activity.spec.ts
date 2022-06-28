import test from "ava";
import rewiremock from "rewiremock";
import { RequestorControlApiMock } from "../mock/requestor_control_api";
import { RequestorSateApiMock } from "../mock/requestor_state_api";
import EventSourceMock, { setExpectedErrorEvents, setExpectedEvents } from "../mock/event_source";
rewiremock("ya-ts-client/dist/ya-activity/api").with({
  RequestorControlApi: RequestorControlApiMock,
  RequestorStateApi: RequestorSateApiMock,
});
rewiremock("eventsource").with(EventSourceMock);
rewiremock.enable();
import { StorageProviderMock } from "../mock/storage_provider";
import { Activity, ActivityStateEnum, ActivityFactory } from "../../yajsapi/mid-level-api/activity";
import {
  Deploy,
  Start,
  Run,
  Terminate,
  SendFile,
  DownloadFile,
  Script,
  CaptureFormat,
  CaptureMode,
} from "../../yajsapi/mid-level-api/script";
import { CancellationToken } from "../../yajsapi/mid-level-api/utils";

test.before(() => {
  process.env.YAGNA_APPKEY = "test";
  process.env.YAGNA_API_BASEPATH = "http://127.0.0.1:7465/activity-api/v1";
});

test("create activity", async (t) => {
  const factory = new ActivityFactory();
  const activity = await factory.create("test_agreement_id");
  t.truthy(activity);
  t.truthy(activity.id);
});

test("create activity without credentials", async (t) => {
  process.env.YAGNA_APPKEY = "";
  t.throws(
    () => {
      new Activity("test_id_0");
    },
    {
      message: "Api key not defined",
    }
  );
  process.env.YAGNA_APPKEY = "test";
});

test("create activity without api base path", async (t) => {
  process.env.YAGNA_API_BASEPATH = "";
  t.throws(
    () => {
      new Activity("test_id_0");
    },
    {
      message: "Api base path not defined",
    }
  );
  process.env.YAGNA_API_BASEPATH = "http://127.0.0.1:7465/activity-api/v1";
});

test("execute commands on activity", async (t) => {
  const activity = new Activity("test_id");
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

test("execute script by streaming batch", async (t) => {
  const activity = new Activity("test_id_2");
  const command1 = new Deploy();
  const command2 = new Start();
  const capture = {
    stdout: { [CaptureMode.STREAM]: { format: CaptureFormat.STR } },
    stderr: { [CaptureMode.STREAM]: { format: CaptureFormat.STR } },
  };
  const command3 = new Run("test_command1", null, null, capture);
  const command4 = new Terminate();
  const script = new Script([command1, command2, command3, command4]);
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
    t.truthy(result);
    if (result.index === 2 && result.stdout) expectedStdout = result.stdout;
  }
  t.is(expectedStdout, "test");
  await script.after();
  await activity.stop();
});

test("handle timeout error while streaming batch", async (t) => {
  const activity = new Activity("test_id_3");
  const command1 = new Deploy();
  const command2 = new Start();
  const capture = {
    stdout: { [CaptureMode.STREAM]: { format: CaptureFormat.STR } },
    stderr: { [CaptureMode.STREAM]: { format: CaptureFormat.STR } },
  };
  const command3 = new Run("test_command1", null, null, capture);
  const command4 = new Terminate();
  const script = new Script([command1, command2, command3, command4]);
  await script.before();
  const results = await activity.execute(script.getExeScriptRequest(), true, 800);
  return new Promise((res) => {
    results.on("error", (error) => {
      t.is(error.toString(), "Error: Activity test_id_3 timeout.");
      return res();
    });
    results.on("data", () => null);
  });
});

test("cancel activity by cancellation token while streaming batch", async (t) => {
  const activity = new Activity("test_id_3");
  const command1 = new Deploy();
  const command2 = new Start();
  const capture = {
    stdout: { [CaptureMode.STREAM]: { format: CaptureFormat.STR } },
    stderr: { [CaptureMode.STREAM]: { format: CaptureFormat.STR } },
  };
  const command3 = new Run("test_command1", null, null, capture);
  const command4 = new Terminate();
  const script = new Script([command1, command2, command3, command4]);
  await script.before();
  const cancellationToken = new CancellationToken();
  const results = await activity.execute(script.getExeScriptRequest(), true, undefined, cancellationToken);
  cancellationToken.cancel();
  return new Promise((res) => {
    results.on("error", (error) => {
      t.is(error.toString(), "Error: Activity test_id_3 has been interrupted.");
      return res();
    });
    results.on("data", () => null);
  });
});

test("handle some error while streaming batch", async (t) => {
  const activity = new Activity("test_id_5");
  const command1 = new Deploy();
  const command2 = new Start();
  const capture = {
    stdout: { [CaptureMode.STREAM]: { format: CaptureFormat.STR } },
    stderr: { [CaptureMode.STREAM]: { format: CaptureFormat.STR } },
  };
  const command3 = new Run("test_command1", null, null, capture);
  const command4 = new Terminate();
  const script = new Script([command1, command2, command3, command4]);
  const expectedErrors = [
    {
      type: "error",
      message: "Some undefined error",
    },
  ];
  setExpectedErrorEvents(activity.id, expectedErrors);
  await script.before();
  const results = await activity.execute(script.getExeScriptRequest(), true);
  return new Promise((res) => {
    results.on("error", (error) => {
      t.is(error.toString(), 'Error: GetExecBatchResults failed due to errors: ["Some undefined error"]');
      return res();
    });
    results.on("data", () => null);
  });
});
