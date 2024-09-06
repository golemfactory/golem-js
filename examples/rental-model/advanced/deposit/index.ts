/**
 * In this example we demonstrate executing tasks on a golem but using funds deposited by another person.
 * It is called Funder. The funder is responsible for allocating the deposit,
 * which will then be used by the Spender (requestor) to create an allocation for a payment.
 *
 * To run the example, it is necessary to define the funder's address in the config.ts file and a private key
 * that will allow depositing specific funds on the contract.
 *
 * In order to check if everything went correctly, the Observer logs transaction information
 * in the smart contract and the script waits for confirmation on the blockchain until the deposit is closed.
 *
 * IMPORTANT: this feature is only supported with yagna versions >= 0.16.0
 */

import funder from "./funder";
import observer from "./observer";
import { GolemNetwork, MarketOrderSpec, waitFor } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({ level: "info" }),
  });

  try {
    await glm.connect();

    const { identity: spenderAddress } = await glm.services.yagna.identity.getIdentity();
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

    // Now the Spender (requestor) can use the deposit to create an allocation
    const allocation = await glm.payment.createAllocation({
      deposit,
      budget,
      expirationSec,
    });

    // We are starting the contract transaction observations for the spender address
    const observation = await observer.startWatchingContractTransactions(spenderAddress);

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
      .then((exe) => exe.run(`echo Task 1 running on provider ${exe.provider.name} 👽`))
      .then((res) => console.log(res.stdout));

    await rental1.stopAndFinalize();

    const rental2 = await glm.oneOf({ order: order2 });

    await rental2
      .getExeUnit()
      .then((exe) => exe.run(`echo Task 2 Running on provider ${exe.provider.name} 🤠`))
      .then((res) => console.log(res.stdout));

    await rental2.stopAndFinalize();

    // Once Spender releases the allocation, the deposit will be closed and cannot be used again.
    await glm.payment.releaseAllocation(allocation);

    // We wait (max 2 mins) for confirmation from blockchain
    await waitFor(observation.isDepositClosed, { abortSignal: AbortSignal.timeout(120_000) });
    observation.stopWatchingContractTransactions();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
