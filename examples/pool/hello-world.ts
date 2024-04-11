import { ActivityPool, MarketModuleImpl, ActivityModuleImpl, YagnaApi } from "@golem-sdk/golem-js";

(async function main() {
  const yagnaApi = new YagnaApi();
  const marketModule = new MarketModuleImpl(yagnaApi);
  const activityModule = new ActivityModuleImpl();

  const pool = new ActivityPool({
    image: "golem/alpine:latest",
    demand: { paymentNetwork: "holesky" },
    marketModule,
    activityModule,
    pool: { min: 2 },
  });
  try {
    await pool.start();
    const ctx1 = await pool.acquire();
    const ctx2 = await pool.acquire();
    console.log(ctx1.provider.name, (await ctx1.run("echo Hello World 1")).stdout);
    console.log(ctx2.provider.name, (await ctx2.run("echo Hello World 2")).stdout);
    await pool.release(ctx1);
    await pool.release(ctx2);
  } catch (err) {
    console.error("Pool execution failed:", err);
  } finally {
    console.log("Finishing...");
    await pool.stop();
  }
})();