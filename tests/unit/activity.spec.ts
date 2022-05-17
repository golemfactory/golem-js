import test from "ava";
import rewiremock from "rewiremock";
import { RequestorControlApiMock, setExpected } from "../mock/api";
rewiremock("ya-ts-client/dist/ya-activity/api").with({ RequestorControlApi: RequestorControlApiMock });
rewiremock.enable();
import { Activity } from "../../yajsapi/mid-level-api/activity/activity";

import { Script, Command } from "../../yajsapi/mid-level-api/activity/script";
import { ActivityStateStateEnum } from "ya-ts-client/dist/ya-activity/src/models/activity-state";

test("create activity", async (t) => {
  const activity = new Activity("test_id");
  t.truthy(activity);
});

test("execute activity", async (t) => {
  const activity = new Activity("test_id");
  const command = new Command("test_command");
  const script = new Script([command]);
  setExpected("exec", 11);
  const results = await activity.execute(script);
  console.log({ results });
  for await (const result of results) {
    t.is(result, "OK");
  }
  return new Promise((res) => {
    activity.on("StateChanged", (state) => {
      t.is(state, ActivityStateStateEnum.Terminated);
      res();
    });
  });
});

test("get activity state by explicit call", async (t) => {
  const activity = new Activity("test_id");
  const state = await activity.getState();
  t.is(state, ActivityStateStateEnum.Deployed);
});

test("get activity state by event", async (t) => {
  const activity = new Activity("test_id");
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
