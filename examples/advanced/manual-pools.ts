import { Allocation, DraftOfferProposalPool, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

const RENT_HOURS = 0.25;

const demandOptions = {
  demand: {
    workload: {
      imageTag: "golem/alpine:latest",
      minCpuCores: 1,
      minMemGib: 1,
      minStorageGib: 2,
    },
  },
  market: {
    rentHours: RENT_HOURS,
    pricing: {
      model: "linear",
      maxStartPrice: 1,
      maxCpuPerHourPrice: 1,
      maxEnvPerHourPrice: 1,
    },
    withProviders: ["0x123123"],
    withoutProviders: ["0x123123"],
    withOperators: ["0x123123"],
    withoutOperators: ["0x123123"],
  },
} as const;

(async () => {
  const logger = pinoPrettyLogger({
    level: "info",
  });

  const glm = new GolemNetwork({
    logger,
  });
  let allocation: Allocation | undefined;

  try {
    await glm.connect();

    allocation = await glm.payment.createAllocation({ budget: 1, expirationSec: RENT_HOURS * 60 * 60 });

    const proposalPool = new DraftOfferProposalPool({ minCount: 1 });
    const demandSpecification = await glm.market.buildDemandDetails(demandOptions.demand, allocation);

    const proposals$ = glm.market.startCollectingProposals({
      demandSpecification,
    });

    const proposalSubscription = proposalPool.readFrom(proposals$);

    /** How many providers you plan to engage simultaneously */
    const CONCURRENCY = 2;

    const depModules = {
      market: glm.market,
      activity: glm.activity,
      payment: glm.payment,
    };

    const pool = depModules.market.createLeaseProcessPool(proposalPool, allocation, {
      replicas: { max: CONCURRENCY },
    });

    const lease = await pool.acquire();
    const lease2 = await pool.acquire();

    await Promise.allSettled([
      lease
        .getExeUnit()
        .then((exe) => exe.run("echo Hello from first activity 👋"))
        .then((result) => console.log(result.stdout)),
      lease2
        .getExeUnit()
        .then((exe) => exe.run("echo Hello from second activity 👋"))
        .then((result) => console.log(result.stdout)),
    ]);

    await pool.release(lease);
    await pool.release(lease2);

    proposalSubscription.unsubscribe();
    await pool.drainAndClear();
  } catch (err) {
    console.error("Pool execution failed:", err);
  } finally {
    await glm.disconnect();
    if (allocation) {
      await glm.payment.releaseAllocation(allocation);
    }
  }
})().catch(console.error);
