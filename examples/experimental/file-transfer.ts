import { readFileSync } from "fs";
import { GolemBackend } from "@golem-sdk/golem-js";

(async function main() {
  const backend = new GolemBackend({
    api: {
      url: process.env.YAGNA_API_URL || "http://127.0.0.1:7465",
      key: process.env.YAGNA_APPKEY || "try-golem",
    },
    image: "golem/alpine:latest",
    market: {
      rentHours: 0.1,
      priceGlmPerHour: 1,
      expectedInstances: 1,
    },
  });

  try {
    await backend.start();
    await backend.work(async (ctx) => {
      await ctx.uploadJson({ test: "1234" }, "/golem/work/test.json");
      const res = await ctx.downloadFile("/golem/work/test.json", "new_test.json");
      console.log(`Result=${res.result}`);
      console.log("File new_test.json: ", readFileSync("new_test.json", "utf-8"));
    });
  } catch (err) {
    console.error("Execution failed", err);
  } finally {
    await backend.stop();
  }
})();
