import { GolemNetwork } from "@golem-sdk/golem-js";

async function main() {
  const golem = new GolemNetwork({
    api: {
      url: process.env.YAGNA_API_URL || "http://127.0.0.1:7465",
      key: process.env.YAGNA_APPKEY || "try-golem",
    },
    market: {},
    dataTransferProtocol: "gftp",
  });

  try {
    await golem.connect();

    const builder = golem.creteDeploymentBuilder();

    builder
      .createNetwork("basic", {
        networkOwnerId: "test",
      })
      .createActivityPool("app", {
        demand: {
          imageTag: "golem/node:latest",
          // image: "golem/node:20",
          // image: "http://golem.io/node:20",
          // imageHash: "0x30984084039480493840",
          minCpuCores: 4,
          minMemGib: 8,
          minStorageGib: 16,
        },
        market: {
          rentHours: 12,
          pricing: {
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
      .createActivityPool("db", {
        demand: {
          imageTag: "golem/alpine:latest",
          minCpuCores: 2,
          minMemGib: 16,
          minStorageGib: 4,
        },
        market: {
          rentHours: 12 /* REQUIRED */,
          pricing: {
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
    const appPool = deployment.getActivityPool("app");
    const dbPool = deployment.getActivityPool("db");

    // Get an instance out of the pool for use
    const app = await appPool.acquire();
    const db = await dbPool.acquire();

    // Run a command on the app VM instance
    const appResult = await app.run("node -v");
    console.log(appResult.stdout);
    await appPool.release(app);

    // Run a command on the db VM instance
    const dbResult = await db.run("ls /");
    console.log(dbResult.stdout);
    await dbPool.release(db);

    // Stop the deployment cleanly
    await deployment.stop();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await golem.disconnect();
  }
}

main().catch(console.error);
