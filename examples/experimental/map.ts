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
      expectedInstances: 10,
    },
  });

  const data = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];

  try {
    await backend.start();
    const futureResults = data.map((x) =>
      backend.work(async (ctx) => {
        const res = await ctx.run(`echo "${x}"`);
        return res.stdout?.toString().trim();
      }),
    );

    const results = await Promise.all(futureResults);
    console.log(results);
  } catch (err) {
    console.error("An error occurred:", err);
  } finally {
    await backend.stop();
  }
})();
