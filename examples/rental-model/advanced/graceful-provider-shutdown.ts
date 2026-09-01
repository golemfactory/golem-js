/**
 * This example shows how to react when the provider you are renting from
 * announces its intention to terminate the agreement - for instance during
 * a graceful shutdown (`golemsp stop --graceful` on the provider).
 *
 * The provider sends an `AgreementTerminationNoticeEvent` through the
 * market: the agreement stays approved and whatever is already running may
 * keep running, but the provider expects you to finish or migrate your work
 * by `terminationDeadline` and may terminate the agreement after that.
 * A cooperative requestor finishes the work it has in flight, schedules no
 * new work on that rental, and terminates the agreement - which also lets
 * the provider finish shutting down sooner.
 */
import { MarketOrderSpec, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

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
  },
};

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
  });

  // Agreement ids for which a shutdown notice arrived.
  const windingDown = new Set<string>();

  try {
    await glm.connect();

    glm.market.events.on("agreementTerminationNoticeReceived", (event) => {
      console.log(
        "Provider '%s' will terminate agreement '%s' at %s (reason: '%s') - finishing up",
        event.agreement.provider.name,
        event.agreement.id,
        event.terminationDeadline.toISOString(),
        event.reason,
      );
      windingDown.add(event.agreement.id);
    });

    const rental = await glm.oneOf({ order });
    const exe = await rental.getExeUnit();

    // Pretend to have a queue of work items. Before each one, check whether
    // the provider asked us to wind down.
    for (let step = 1; step <= 10; step++) {
      if (windingDown.has(rental.agreement.id)) {
        console.log("Skipping the remaining work - the provider is shutting down");
        break;
      }
      const res = await exe.run(`echo "work item ${step}" && sleep 5`);
      console.log((res.stdout as string).trim());
    }

    // Terminating promptly is what the shutting-down provider is waiting for.
    await rental.stopAndFinalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
