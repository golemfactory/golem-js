import test from "ava";
import Queue from "./queue";
import sleep from "./sleep";

let queue!: Queue<string>;

test.before((t) => {
  queue = new Queue();
  queue.put("odin");
});

test("queue put/get", async (t) => {
  const result: string = await queue.get();
  t.is(result, "odin");
});

test("queue wait for item with timeout", async (t) => {
  const result: undefined = await Promise.race([
    queue.get() as any,
    sleep(0.5),
  ]);
  t.is(result, undefined);
});

test("queue initial item", async (t) => {
  const tempQueue: Queue<string> = new Queue(["test"]);
  const result = await tempQueue.get();
  t.is(result, "test");
});

test("queue empty", async (t) => {
  await sleep(0.5);
  queue.put("odin");
  queue.empty();
  const result = await Promise.race([queue.get() as any, sleep(0.5)]);
  t.is(result, undefined);
});
