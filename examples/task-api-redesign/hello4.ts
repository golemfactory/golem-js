import { Golem } from "../../dist";
import path from "path";
import { readFileSync } from "fs";

(async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await golem.init();
  await golem.run<string>(async (ctx) => {
    await ctx.uploadJson("/golem/work/test.json", { test: "1234" });
    const res = await ctx.downloadFile("/golem/work/test.json", path.join(__dirname, "new_test.json"));
    console.log(`Result=${res.result}`);
    console.log("File new_test.json: ", readFileSync("new_test.json", "utf-8"));
  });
  await golem.end();
})();
