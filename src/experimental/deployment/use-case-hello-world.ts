import { GolemDeploymentBuilder } from "./deployment-builder";
import { GolemServiceCommands } from "./deployment";

/**
 * We want to be a devops platform
 * We want to have similar nomencalature / DX to docker-compose
 */
async function main() {
  const deployment = new GolemDeploymentBuilder()
    .createService("example", {
      image: "golemfactory/hello-world:latest",
      replicas: {
        min: 1,
      },
    })
    .build();

  try {
    await deployment.start();

    await deployment.service("example").work(async ({ run, uploadFile }: GolemServiceCommands) => {
      await run("echo", ["Hello World!"]);
      await uploadFile("hello.txt", "hello.txt");
    });

    await deployment.service("example").work(async (provider, requestor) => {
      await provider.run("echo", ["Hello World!"]);
      await requestor.executeOnProvider("echo", ["Hello World!"]);

      await requestor.uploadFile("hello.txt", "hello.txt");
      await requestor.downloadFile("hello.txt", "hello.txt");
    });

    const batch;

    batch.run();
    batch.uploadFile();
    await deployment.service("example").sendScript(batch);

    await deployment.service("example").sendScript(async (runner) => {
      await runner.run("echo", ["Hello World!"]);
      await runner.uploadFile("hello.txt", "hello.txt");
    });
  } catch (e) {
    console.error(e);
  } finally {
    await deployment.stop();
  }
}

main().catch(console.error);
