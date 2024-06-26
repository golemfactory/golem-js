import { MarketOrderSpec, GolemNetwork, OfferProposalFilterFactory } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

/**
 * Example showing how to use a offer proposal filter using the predefined filter `disallowProvidersByName`,
 * which blocks any proposal from a provider whose name is in the array of
 */

const blackListProvidersNames = ["provider-1", "bad-provider", "slow-provider"];

const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
  },
  market: {
    rentHours: 0.5,
    pricing: {
      model: "linear",
      maxStartPrice: 0.5,
      maxCpuPerHourPrice: 1.0,
      maxEnvPerHourPrice: 0.5,
    },
    offerProposalFilter: OfferProposalFilterFactory.disallowProvidersByName(blackListProvidersNames),
  },
};

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
  });

  try {
    await glm.connect();
    const rental = await glm.oneOf({ order });
    await rental
      .getExeUnit()
      .then((exe) => exe.run(`echo [provider:${exe.provider.name}] Hello, Golem! 👋`))
      .then((res) => console.log(res.stdout));
    await rental.stopAndFinalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
