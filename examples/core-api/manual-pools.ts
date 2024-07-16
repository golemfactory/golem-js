import { Allocation, DraftOfferProposalPool, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

const RENTAL_DURATION_HOURS = 0.25;
const ALLOCATION_DURATION_HOURS = RENTAL_DURATION_HOURS + 0.25;

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
    rentHours: RENTAL_DURATION_HOURS,
    pricing: {
      model: "linear",
      maxStartPrice: 1,
      maxCpuPerHourPrice: 1,
      maxEnvPerHourPrice: 1,
    },
  },
} as const;

(async () => {
  const logger = pinoPrettyLogger({
    level: "debug",
  });

  const glm = new GolemNetwork({
    logger,
  });

  console.assert(
    ALLOCATION_DURATION_HOURS > RENTAL_DURATION_HOURS,
    "Always create allocations that will live longer than the planned rental duration",
  );

  let allocation: Allocation | undefined;

  try {
    await glm.connect();

    allocation = await glm.payment.createAllocation({ budget: 1, expirationSec: ALLOCATION_DURATION_HOURS * 60 * 60 });

    const proposalPool = new DraftOfferProposalPool({ minCount: 1 });
    const demandSpecification = await glm.market.buildDemandDetails(
      demandOptions.demand,
      demandOptions.market,
      allocation,
    );

    const draftProposal$ = glm.market.collectDraftOfferProposals({
      demandSpecification,
      pricing: demandOptions.market.pricing,
    });

    const proposalSubscription = proposalPool.readFrom(draftProposal$);

    /** How many providers you plan to engage simultaneously */
    const PARALLELISM = 2;

    const depModules = {
      market: glm.market,
      activity: glm.activity,
      payment: glm.payment,
      rental: glm.rental,
    };

    const pool = depModules.rental.createResourceRentalPool(proposalPool, allocation, {
      poolSize: { max: PARALLELISM },
    });

    const rental1 = await pool.acquire();
    const rental2 = await pool.acquire();

    await Promise.allSettled([
      rental1
        .getExeUnit()
        .then((exe) => exe.run("echo Hello from first activity 👋"))
        .then((result) => console.log(result.stdout)),
      rental2
        .getExeUnit()
        .then((exe) => exe.run("echo Hello from second activity 👋"))
        .then((result) => console.log(result.stdout)),
    ]);

    await pool.release(rental1);
    await pool.release(rental2);

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
