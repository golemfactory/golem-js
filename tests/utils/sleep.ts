import test from "ava";
import { performance } from "perf_hooks";
import sleep from "../../yajsapi/utils/sleep";

test("sleep", async t => {
    const t0 = performance.now();
    await sleep(2);
    const t1 = performance.now();
    t.assert(t1 - t0 > 2);
})
