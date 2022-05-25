import test from "ava";
import { Script, Run } from "../../yajsapi/mid-level-api/script/script";

test("create simple script with one command", async (t) => {
  const command = new Run("date");
  const script = new Script([command]);
  t.deepEqual(script, {
    todo: true,
  });
});
