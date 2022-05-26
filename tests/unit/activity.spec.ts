import test from "ava";
import rewiremock from "rewiremock";
import { RequestorControlApiMock } from "../mock/requestor_control_api";
import { RequestorSateApiMock } from "../mock/requestor_state_api";
rewiremock("ya-ts-client/dist/ya-activity/api").with({
  RequestorControlApi: RequestorControlApiMock,
  RequestorStateApi: RequestorSateApiMock,
});
rewiremock.enable();
import { Activity } from "../../yajsapi/mid-level-api/activity";
import { Deploy, Start, Run, Terminate, Script } from "../../yajsapi/mid-level-api/script";
import { ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity/src/models/activity-state";

test("create activity", async (t) => {
  const activity = new Activity("test_id");
  t.truthy(activity);
});

test("execute commands on activity", async (t) => {
  const activity = new Activity("test_id");
  const result1 = await activity.executeCommand(new Deploy());
  const result2 = await activity.executeCommand(new Start());
  const result3 = await activity.executeCommand(new Run("test_command"));
  const result4 = await activity.executeCommand(new Terminate());

  t.is(result1.result, "Ok");
  t.is(result2.result, "Ok");
  t.is(result3.result, "Ok");
  t.is(result3.stdout, "test_result");
  t.is(result4.result, "Ok");
});

test("execute commands and get state", async (t) => {
  const activity = new Activity("test_id");
  const result = await activity.executeCommand(new Run("test_command"));
  activity["stateApi"]["setExpected"]("getActivityState", [ActivityStateStateEnum.Ready, null]);
  const stateAfterRun = await activity.getState();
  t.is(result.result, "Ok");
  t.is(stateAfterRun, ActivityStateStateEnum.Ready);
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
  const results = await activity.executeScript(script);
  for await (const result of results) {
    t.is(result.result, "Ok");
    t.is(result.stdout, expectedRunStdOuts.shift());
  }
});

test("execute script and get results by events", async (t) => {
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
  const results = await activity.executeScript(script);
  return new Promise((res) => {
    results.on("data", (result) => {
      t.is(result.result, "Ok");
      t.is(result.stdout, expectedRunStdOuts.shift());
    });
    results.on("end", res);
  });
});

test("get activity state by direct call", async (t) => {
  const activity = new Activity("test_id");
  activity["stateApi"]["setExpected"]("getActivityState", [
    ActivityStateStateEnum.Ready,
    ActivityStateStateEnum.Terminated,
  ]);
  const state = await activity.getState();
  t.is(state, ActivityStateStateEnum.Ready);
});

test("get activity state by event", async (t) => {
  const activity = new Activity("test_id", { stateFetchInterval: 5 });
  const nextStates = [
    [ActivityStateStateEnum.Initialized, ActivityStateStateEnum.Ready],
    [ActivityStateStateEnum.Ready, ActivityStateStateEnum.Deployed],
    [ActivityStateStateEnum.Deployed, ActivityStateStateEnum.Unresponsive],
    [ActivityStateStateEnum.Unresponsive, ActivityStateStateEnum.Terminated],
    [ActivityStateStateEnum.Terminated, null],
  ];
  activity["stateApi"]["setExpectedNextStates"]([...nextStates]);
  return new Promise((res) => {
    activity.on("StateChanged", (state) => {
      const expectedState = nextStates?.[0]?.[0];
      t.is(state, expectedState);
      if (nextStates.length > 1) nextStates.shift();
      else res();
    });
  });
});

test("stop activity", async (t) => {
  const activity = new Activity("test_id");
  t.is(await activity.stop(), true);
});
