import test from "ava";
import rewiremock from "rewiremock";
import { RequestorControlApiMock } from "../mock/requestor_control_api";
import { RequestorSateApiMock } from "../mock/requestor_state_api";
rewiremock("ya-ts-client/dist/ya-activity/api").with({
  RequestorControlApi: RequestorControlApiMock,
  RequestorStateApi: RequestorSateApiMock,
});
rewiremock.enable();
import { Activity } from "../../yajsapi/mid-level-api/activity/activity";
import { Script, Command } from "../../yajsapi/mid-level-api/activity/script";
import { ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity/src/models/activity-state";

test("create activity", async (t) => {
  const activity = new Activity("test_id");
  t.truthy(activity);
});

test("execute activity and get results by iterator", async (t) => {
  const activity = new Activity("test_id");
  const command = new Command("test_command");
  const script = new Script([command]);
  activity["api"]["setExpected"]("exec", "test_batch_id");
  activity["api"]["setExpected"]("getExecBatchResults", ["one", "two", "three", "four"]);
  const expectedResults = ["one", "two", "three", "four"];
  const results = await activity.execute(script);
  for await (const result of results) {
    t.is(result, expectedResults.pop());
  }
});

test("execute activity and get results by events", async (t) => {
  const activity = new Activity("test_id");
  const command = new Command("test_command");
  const script = new Script([command]);
  activity["api"]["setExpected"]("exec", "test_batch_id");
  activity["api"]["setExpected"]("getExecBatchResults", ["one", "two", "three", "four"]);
  const expectedResults = ["one", "two", "three", "four"];
  const results = await activity.execute(script);
  return new Promise((res) => {
    results.on("data", (result) => {
      t.is(result, expectedResults.pop());
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
  const activity = new Activity("test_id");
  activity["stateApi"]["setExpected"]("getActivityState", [
    ActivityStateStateEnum.Ready,
    ActivityStateStateEnum.Terminated,
  ]);
  return new Promise((res) => {
    activity.on("StateChanged", (state) => {
      t.is(state, ActivityStateStateEnum.Ready);
      res();
    });
  });
});

test("stop activity", async (t) => {
  const activity = new Activity("test_id");
  t.is(await activity.stop(), true);
});
