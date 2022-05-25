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
import { Start, Deploy, Run, Terminate } from "../../yajsapi/mid-level-api/script";

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
  t.is(result3.stdout, "Result 1");
  t.is(result4.result, "Ok");
});
