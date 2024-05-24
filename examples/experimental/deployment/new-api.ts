import { GolemNetwork } from "@golem-sdk/golem-js";
import { GolemDeploymentBuilder } from "@golem-sdk/golem-js/experimental";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

async function main() {
  const golem = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
  });

  try {
    await golem.connect();

    const builder = new GolemDeploymentBuilder(golem);

    builder
      .createNetwork("basic", {
        ip: "192.168.7.0/24",
      })
      .createLeaseProcessPool("app", {
        demand: {
          workload: {
            imageTag: "golem/node:latest",
          },
        },
        market: {
          maxAgreements: 1,
          rentHours: 12,
          pricing: {
            model: "linear",
            maxStartPrice: 1,
            maxCpuPerHourPrice: 1,
            maxEnvPerHourPrice: 1,
          },
          withProviders: ["0x123123"],
          withoutProviders: ["0x123123"],
          withOperators: ["0x123123"],
          withoutOperators: ["0x123123"],
        },
        deployment: {
          replicas: 2,
          network: "basic",
        },
      })
      .createLeaseProcessPool("db", {
        demand: {
          workload: {
            imageTag: "golem/alpine:latest",
            minCpuCores: 1,
            minMemGib: 2,
            minStorageGib: 4,
          },
        },
        market: {
          maxAgreements: 1,
          rentHours: 12 /* REQUIRED */,
          pricing: {
            model: "linear",
            maxStartPrice: 1 /* REQUIRED */,
            maxCpuPerHourPrice: 1 /* REQUIRED */,
            maxEnvPerHourPrice: 1 /* REQUIRED */,
          },
        },
        deployment: {
          replicas: 1,
          network: "basic",
        },
      });

    const deployment = builder.getDeployment();

    // Start your deployment
    await deployment.start();

    // Get your pool of activities for specified need
    const appPool = deployment.getLeaseProcessPool("app");
    const dbPool = deployment.getLeaseProcessPool("db");

    // Get an instance out of the pool for use
    const appReplica1 = await appPool.acquire();
    const appReplica2 = await appPool.acquire();
    const dbReplica = await dbPool.acquire();

    await Promise.allSettled([
      appReplica1
        .getExeUnit()
        .then((exe) => exe.run("echo Running some code on app replica 1 🏃"))
        .then((res) => console.log(res.stdout)),
      appReplica2
        .getExeUnit()
        .then((exe) => exe.run("echo Running some code on app replica 2 🏃"))
        .then((res) => console.log(res.stdout)),
      dbReplica
        .getExeUnit()
        .then((exe) => exe.run("echo Running some code on db replica 🏃"))
        .then((res) => console.log(res.stdout)),
    ]);

    await Promise.allSettled([appPool.destroy(appReplica1), appPool.destroy(appReplica2), dbPool.destroy(dbReplica)]);

    // Stop the deployment cleanly
    await deployment.stop();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await golem.disconnect();
  }
}

main().catch(console.error);
