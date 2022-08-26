import { Golem } from "../../dist";
import path from "path";
import { readFileSync } from "fs";

(async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  await golem.run<string>(async (ctx) => {
    const res = await ctx.uploadFile(path.join(__dirname, "./cubes.blend"), "/golem/resource/scene.blend");
    console.log(`Result=${res.result}`);
  });
  await golem.end();
})();
