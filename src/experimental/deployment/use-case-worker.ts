import { GolemDeploymentBuilder } from "./deployment-builder";

async function main() {
  const builder = new GolemDeploymentBuilder();
  builder.createService("worker", {});

  const deployment = builder.build();


  await deployment.start();

  const activity = await deployment.service("worker").acquire();

  const worker = new Worker("worker.js", { context: activity.commands() });

  await deployment.stop();
}
