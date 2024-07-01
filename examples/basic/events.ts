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

    glm.market.events.on("agreementApproved", (event) => {
      console.log("Agreement '%s' approved", event.agreement.id);
    });

    glm.market.events.on("agreementTerminated", (event) => {
      console.log(
        "Agreement '%s' terminated by '%s' with reason '%s'",
        event.agreement.id,
        event.terminatedBy,
        event.reason,
      );
    });

    glm.market.events.on("offerCounterProposalRejected", (event) => {
      console.warn("Proposal rejected by provider", event);
    });

    const rental = await glm.oneOf({
      order: {
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
        },
      },
    });

    await rental
      .getExeUnit()
      .then((exe) => exe.run("echo Hello, Golem! 👋"))
      .then((res) => console.log(res.stdout));

    await rental.stopAndFinalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
