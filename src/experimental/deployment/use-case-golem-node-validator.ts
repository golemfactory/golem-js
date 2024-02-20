import { GolemDeploymentBuilder } from "./deployment-builder";

declare function withoutProviders(): any;

async function main() {
  const tasks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];

  const builder = new GolemDeploymentBuilder();
  builder
    .createService("example", {
      replicas: {
        min: 1,
        max: 10,
      },
      market: {
        proposalFilters: [withoutProviders()],
        rentHours: 120,
        paymentNetwork: "polygon",
        priceGlmPerHour: 0.1,
      },
      initTimeoutSec: 90,
      defaultAcquireTimeoutSec: 360,
    })
    .createService("example2", {
      replicas: {
        min: 1,
        max: 10,
      },
      market: {
        proposalFilters: [withoutProviders()],
        rentHours: 120,
        paymentNetwork: "polygon",
        priceGlmPerHour: 0.1,
      },
      initTimeoutSec: 90,
      defaultAcquireTimeoutSec: 360,
    });

  const deployment = builder.build();
  deployment.events.on("activityInitError", (error) => {
    if (error.activityInfo.serviceName !== "example") {
      return;
    }

    console.log(
      `Activity failed on agreement ${error.activityInfo.agreementId} and provider ${error.activityInfo.provider}`,
    );
  });

  await deployment.start();

  // const allTasks: Promise<any>[] = [];
  for (const task of tasks) {
    const activity = await deployment.service("example").acquire();

    await activity
      .work(async (context) => {
        await context.uploadFile("fib.js", "fib.js");
        const result = await context.run("node", ["fib.js", task.toString()]);

        return JSON.parse(result.stdout as string);
      })
      .then((value) => {
        console.log({
          provider: activity.info.provider,
          value,
        });
        deployment.service("example").release(activity);
      })
      .catch((error) => {
        console.error(error);
        deployment.service("example").destroy(activity);
      });
  }

  await deployment.stop();
}
