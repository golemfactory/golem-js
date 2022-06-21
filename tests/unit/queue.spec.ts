import test from "ava";
import Queue from "../../yajsapi/utils/queue";
import sleep from "../../yajsapi/utils/sleep";

let queueSpec!: Queue<string>;

test.before((t) => {
  queueSpec = new Queue();
  queueSpec.put("odin");
});

test("queue put/get", async (t) => {
  const result: string = await queueSpec.get();
  t.is(result, "odin");
});

test("queue wait for item with timeout", async (t) => {
  const result: undefined = await Promise.race([queueSpec.get() as any, sleep(0.5)]);
  t.is(result, undefined);
});

test("queue initial item", async (t) => {
  const tempQueue: Queue<string> = new Queue(["test"]);
  const result = await tempQueue.get();
  t.is(result, "test");
});

test("queue empty", async (t) => {
  await sleep(0.5);
  queueSpec.put("odin");
  queueSpec.empty();
  const result = await Promise.race([queueSpec.get() as any, sleep(0.5)]);
  t.is(result, undefined);
});
