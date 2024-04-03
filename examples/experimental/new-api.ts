import { GolemNetworkNew } from "@golem-sdk/golem-js/experimental";

async function main() {
  const golem = new GolemNetworkNew({
    api: {
      url: process.env.YAGNA_API_URL || "http://127.0.0.1:7465",
      key: process.env.YAGNA_APPKEY || "try-golem",
    },
    payment: {},
    market: {},
    dataTransferProtocol: "gftp",
  });

  await golem.connect();

  const builder = golem.createBuilder();

  // const deployment = golem.createDeployment();

  builder
    .createNetwork("basic", {
      networkOwnerId: "test",
    })
    .createActivityPool("app", {
      image: "file://golem/node:20",
      // image: "golem/node:20",
      // image: "http://golem.io/node:20",
      // imageHash: "0x30984084039480493840",
      resources: {
        minCpu: 4,
        minMemGib: 8,
        minStorageGib: 16,
      },
      replicas: 10,
      network: "basic",
      market: {
        rentHours: 12 /* REQUIRED */,
        pricing: {
          maxStartPrice: 1 /* REQUIRED */,
          maxCpuPerHourPrice: 1 /* REQUIRED */,
          maxEnvPerHourPrice: 1 /* REQUIRED */,
        },
        withProviders: ["0x123123"],
        withoutProviders: ["0x123123"],
        withOperators: ["0x123123"],
        withoutOperators: ["0x123123"],
      },
      payment: {},
      // dataTransferProtocol: "gftp",
    })
    .createActivityPool("db", {
      image: "golem/redis",
      resources: {
        minCpu: 2,
        minMemGib: 16,
        minStorageGib: 4,
      },
      replicas: 3,
      market: {
        rentHours: 12 /* REQUIRED */,
        pricing: {
          maxStartPrice: 1 /* REQUIRED */,
          maxCpuPerHourPrice: 1 /* REQUIRED */,
          maxEnvPerHourPrice: 1 /* REQUIRED */,
        },
      },
      network: "basic",
    });

  const deployment = builder.getDeployment();

  await deployment.start();

  const activityPoolApp = deployment.getActivityPool("app");
  const activity1 = await activityPoolApp.acquire();

  const result = await activity1.run("node -v");
  console.log(result.stdout);
  await activityPoolApp.release(activity1);
  // await activityPoolApp.stop();
  await activityPoolApp.drain();

  const result2 = await deployment.getActivityPool("db").runOnce((ctx) => ctx.run("redis -v"));
  console.log(result2.stdout);

  await deployment.stop();

  await golem.disconnect();
}

main().catch(console.error);
