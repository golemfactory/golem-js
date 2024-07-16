import { MarketOrderSpec, GolemNetwork, OfferProposalFilter } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

/**
 * Example demonstrating how to write a custom offer proposal filter.
 * In this case the offer proposal must include VPN access and must not be from "bad-provider"
 */
const myFilter: OfferProposalFilter = (proposal) =>
  Boolean(
    proposal.provider.name !== "bad-provider" && proposal.properties["golem.runtime.capabilities"]?.includes("vpn"),
  );

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
    offerProposalFilter: myFilter,
  },
};

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "debug",
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
