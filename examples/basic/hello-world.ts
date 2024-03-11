import {
  Activity,
  AgreementPoolService,
  MarketService,
  Package,
  PaymentService,
  WorkContext,
  YagnaApi,
} from "@golem-sdk/golem-js";

(async () => {
  console.log("Starting core services...");
  const yagna = new YagnaApi();

  const DURATION_SEC = 6 * 60;

  const payment = new PaymentService(yagna, {
    payment: {
      network: "goerli",
    },
  });

  await payment.run();

  const allocation = await payment.createAllocation({
    budget: 1.0,
    expirationSec: DURATION_SEC,
  });

  const agreementPool = new AgreementPoolService(yagna);

  const market = new MarketService(agreementPool, yagna, {
    expirationSec: DURATION_SEC,
  });

  const workload = Package.create({
    imageTag: "golem/alpine:latest",
  });

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

    // Main piece of your logic
    const result = await ctx.run("echo 'Hello World!'");
    console.log(result);

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
  console.log("Services shutdown complete...");
})().catch(console.error);
