import funder from "./funder";
import observer from "./observer";
import { GolemNetwork, MarketOrderSpec, waitFor } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";
import chalk from "chalk";

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({ level: "info" }),
  });

  try {
    await glm.connect();

    // const spenderAddress = glm.getIdentity().identity; TODO
    const spenderAddress = "0x19ee20338a4c4bf8f6aebc79d9d3af2a01434119";
    const budget = 1.0;
    const fee = 0.5;
    const expirationSec = 60 * 60; // 1 hour

    // In order for a founder to create a deposit, he must first create an allowance.
    await funder.createAllowance({ budget, fee });
    // Check if allowance was created correctly
    await funder.checkAllowance();

    const deposit = await funder.createDeposit({ address: spenderAddress, budget, fee, expirationSec });
    // The funder can also extend the deposit, for example by extending expiration time
    await funder.extendDeposit({ expirationSec: expirationSec + 5 * 60 }); // extend time by 5 min

    // After the deposit is properly prepared, the funder can clear the allowance
    await funder.clearAllowance();

    const allocation = await glm.payment.createAllocation({
      deposit,
      budget,
      expirationSec,
    });

    const { stopWatchingContractTransactions, isDepositClosed } =
      await observer.startWatchingContractTransactions(spenderAddress);

    const order1: MarketOrderSpec = {
      demand: {
        workload: { imageTag: "golem/alpine:latest" },
      },
      market: {
        rentHours: 0.5,
        pricing: {
          model: "burn-rate",
          avgGlmPerHour: 0.5,
        },
      },
      payment: {
        allocation,
      },
    };

    const order2: MarketOrderSpec = {
      demand: {
        workload: { imageTag: "golem/alpine:latest" },
      },
      market: {
        rentHours: 0.5,
        pricing: {
          model: "burn-rate",
          avgGlmPerHour: 0.5,
        },
      },
      payment: {
        allocation: allocation.id, // alternative way to pass allocation ID
      },
    };

    const rental1 = await glm.oneOf({ order: order1 });

    await rental1
      .getExeUnit()
      .then((exe) => exe.run(`echo Task 1 running on ${exe.provider.name}`))
      .then((res) => console.log(chalk.inverse("\n", res.stdout)));

    await rental1.stopAndFinalize();

    const rental2 = await glm.oneOf({ order: order2 });

    await rental2
      .getExeUnit()
      .then((exe) => exe.run(`echo Task 2 Running on ${exe.provider.name}`))
      .then((res) => console.log(chalk.inverse("\n", res.stdout)));

    await rental2.stopAndFinalize();

    // Once the spender releases the allocation, the deposit will be closed
    // and you will not be able to use it again.
    await glm.payment.releaseAllocation(allocation);

    await waitFor(isDepositClosed);
    stopWatchingContractTransactions();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
