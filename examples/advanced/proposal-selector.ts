import { MarketOrderSpec, GolemNetwork, OfferProposal } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

/**
 * Example demonstrating how to write a selector which choose the best provider based on scores provided as object: [providerName]: score
 * A higher score rewards the provider.
 */
const scores = {
  "provider-1": 100,
  "golem-provider": 50,
  "super-provider": 25,
};

const bestProviderSelector = (scores: { [providerName: string]: number }) => (proposals: OfferProposal[]) => {
  proposals.sort((a, b) => ((scores?.[a.provider.name] || 0) >= (scores?.[b.provider.name] || 0) ? -1 : 1));
  return proposals[0];
};

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
    proposalSelector: bestProviderSelector(scores),
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
    const lease = await glm.oneOf(order);
    await lease
      .getExeUnit()
      .then((exe) => exe.run(`echo [provider:${exe.provider.name}] Hello, Golem! 👋`))
      .then((res) => console.log(res.stdout));
    await lease.finalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
