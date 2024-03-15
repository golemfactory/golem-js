import {
  Activity,
  AgreementPoolService,
  MarketService,
  Package,
  PaymentService,
  WorkContext,
  YagnaApi,
  serveLocalGvmi,
} from "@golem-sdk/golem-js";
import { fileURLToPath } from "url";

// get the absolute path to the local image in case this file is run from a different directory
const getImagePath = (path: string) => fileURLToPath(new URL(path, import.meta.url).toString());

const localImagePath = getImagePath("./alpine.gvmi");
const server = serveLocalGvmi(localImagePath);

async function main() {
  console.log("Serving local image to the providers...");
  await server.serve();
  const { url, hash } = server.getImage();
  const workload = Package.create({
    imageHash: hash,
    imageUrl: url,
  });

  console.log("Starting core services...");

  const yagna = new YagnaApi();

  const payment = new PaymentService(yagna);

  await payment.run();

  const allocation = await payment.createAllocation({
    budget: 1.0,
  });

  const agreementPool = new AgreementPoolService(yagna);

  const market = new MarketService(agreementPool, yagna);

  await agreementPool.run();
  await market.run(workload, allocation);
  console.log("Core services started");

  try {
    const agreement = await agreementPool.getAgreement();
    payment.acceptPayments(agreement);

    const activity = await Activity.create(agreement, yagna);
    // Stop listening for new proposals
    await market.end();

    const ctx = new WorkContext(activity, {});

    console.log("Activity initialized, status:", await activity.getState());
    await ctx.before();
    console.log("Activity deployed and ready for use, status:", await activity.getState());
    console.log("Provider executing the activity:", ctx.provider.name);

    // Main piece of your logic
    const result = await ctx.run("cat hello.txt");
    console.log("===============================");
    console.log(result.stdout?.toString().trim());
    console.log("===============================");

    console.log("Work completed");
    // Stop the activity on the provider once you're done
    await activity.stop();
    // Release the agreement without plans to re-use -> it's going to terminate this agreement
    await agreementPool.releaseAgreement(agreement.id, false);
  } catch (err) {
    console.error("Failed to run example on Golem", err);
  }

  console.log("Shutting down services...");
  await market.end();
  await agreementPool.end();
  await payment.end();
  console.log("Stoping the local image server...");
  await server.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
