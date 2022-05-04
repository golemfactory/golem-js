import test from "ava";
import { Activity } from "../yajsapi/mid-level-api/activity";

test("create activity", async (t) => {
    const activity = new Activity('test_id');
    t.truthy(activity);
});
