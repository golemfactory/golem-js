import { TaskExecutor } from "@golem-sdk/golem-js";
import { readFileSync } from "fs";

(async function main() {
  const executor = await TaskExecutor.create("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await executor.run(async (ctx) => {
    await ctx.uploadJson({ test: "1234" }, "/golem/work/test.json");
    const res = await ctx.downloadFile("/golem/work/test.json", "new_test.json");
    console.log(`Result=${res.result}`);
    console.log("File new_test.json: ", readFileSync("new_test.json", "utf-8"));
  });
  await executor.end();
})();
