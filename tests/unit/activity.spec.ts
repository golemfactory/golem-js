import test from "ava";
import { Activity } from "../../yajsapi/mid-level-api/activity/activity";
import { Script, Command } from "../../yajsapi/mid-level-api/activity/script";

test("create activity", async (t) => {
  const activity = new Activity("test_id");
  t.truthy(activity);
});

test("execute activity", async (t) => {
  const activity = new Activity("test_id");
  const command = new Command("test_command");
  const script = new Script([command]);
  const results = await activity.execute(script);
  for await (const result of results) {
    t.is(result, "OK");
  }
});

test("stop activity", async (t) => {
  const activity = new Activity("test_id");
  t.is(await activity.stop(), true);
});
