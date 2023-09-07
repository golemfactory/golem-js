import { TaskExecutor } from "@golem-sdk/golem-js";
import { readFileSync } from "fs";

(async function main() {
  const executor = await TaskExecutor.create("golem/alpine:3.18.2");
  await executor.run(async (ctx) => {
    await ctx.uploadJson({ test: "1234" }, "/golem/work/test.json");
    const res = await ctx.downloadFile("/golem/work/test.json", "new_test.json");
    console.log(`Result=${res.result}`);
    console.log("File new_test.json: ", readFileSync("new_test.json", "utf-8"));
  });
  await executor.end();
})();
