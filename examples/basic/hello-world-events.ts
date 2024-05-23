/**
 * This example showcases how users can listen to various events exposed from golem-js
 */
import { DemandSpec, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

const demandOptions: DemandSpec = {
  demand: {
    activity: { imageTag: "golem/alpine:latest" },
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
};

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

    glm.market.events.agreements.on("agreementConfirmed", (event) => {
      console.log("Agreement '%s' confirmed at %s", event.agreement.id, event.timestamp);
    });

    glm.market.events.agreements.on("agreementTerminated", (event) => {
      console.log(
        "Agreement '%s' terminated by '%s' with reason '%s' at %s",
        event.agreement.id,
        event.terminatedBy,
        event.reason,
        event.timestamp,
      );
    });

    const lease = await glm.oneOf(demandOptions);
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
