/**
 * This example showcases how users can listen to various events exposed from golem-js
 */
import { GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
    payment: {
      driver: "erc20",
      network: "holesky",
    },
  });

  try {
    await glm.connect();

    glm.market.events.on("agreementConfirmed", (agreement) => {
      console.log("Agreement '%s' confirmed", agreement.id);
    });

    glm.market.events.on("agreementTerminated", (agreement, terminatedBy, reason) => {
      console.log("Agreement '%s' terminated by '%s' with reason '%s'", agreement.id, terminatedBy, reason);
    });

    glm.market.events.on("counterProposalRejectedByProvider", (proposal, reason) => {
      console.warn("Proposal rejected by provider", proposal, reason);
    });

    const lease = await glm.oneOf({
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
      },
    });

    await lease
      .getExeUnit()
      .then((exe) => exe.run("echo Hello, Golem! 👋"))
      .then((res) => console.log(res.stdout));

    await lease.finalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
