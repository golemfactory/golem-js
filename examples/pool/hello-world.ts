import { DraftOfferProposalPool, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const logger = pinoPrettyLogger({
    level: "debug",
  });

  const glm = new GolemNetwork({
    logger,
    payment: {
      payment: {
        driver: "erc20",
        network: "holesky",
      },
    },
  });
  let allocation;

  try {
    await glm.connect();
    allocation = await glm.payment.createAllocation({ budget: 1 });

    const demandOptions = {
      demand: {
        imageTag: "golem/alpine:latest",
        minCpuCores: 1,
        minMemGib: 1,
        minStorageGib: 2,
      },
      market: {
        rentHours: 12,
        pricing: {
          maxStartPrice: 1,
          maxCpuPerHourPrice: 1,
          maxEnvPerHourPrice: 1,
        },
        withProviders: ["0x123123"],
        withoutProviders: ["0x123123"],
        withOperators: ["0x123123"],
        withoutOperators: ["0x123123"],
      },
    };

    const proposalPool = new DraftOfferProposalPool({ minCount: 1 });
    const payerDetails = await glm.payment.getPayerDetails();
    const demandSpecification = await glm.market.buildDemand(demandOptions.demand, payerDetails);

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

    const pool = depModules.market.createLeasePool(proposalPool, allocation, {
      replicas: { max: CONCURRENCY },
      logger,
    });

    const lease = await pool.acquire();
    const exe = await lease.getExeUnit();
    const result = await exe.run("echo Hello World");
    console.log(result.stdout);

    const lease2 = await pool.acquire();
    const exe2 = await lease2.getExeUnit();
    const result2 = await exe2.run("echo Hello Golem");
    console.log(result2.stdout);

    await pool.release(lease);
    await pool.release(lease2);

    proposalSubscription.unsubscribe();
    await pool.drainAndClear();
    await allocation.release();
  } catch (err) {
    console.error("Pool execution failed:", err);
  } finally {
    await glm.disconnect();
    allocation?.release();
  }
})().catch(console.error);
