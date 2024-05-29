import { MarketOrderSpec, GolemNetwork, ProposalFilter } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

/**
 * Example demonstrating how to write a custom proposal filter.
 * In this case the proposal must include VPN access and must not be from "bad-provider"
 */
const myFilter: ProposalFilter = (proposal) => {
  return (
    proposal.provider.name !== "bad-provider" && proposal.properties["golem.runtime.capabilities"]?.includes("vpn")
  );
};

const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
  },
  market: {
    maxAgreements: 1,
    rentHours: 0.5,
    pricing: {
      model: "linear",
      maxStartPrice: 0.5,
      maxCpuPerHourPrice: 1.0,
      maxEnvPerHourPrice: 0.5,
    },
    proposalFilter: myFilter,
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
