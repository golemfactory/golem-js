/**
 * This advanced example shows how to use the setup and teardown lifecycle functions
 * to avoid doing the same work multiple times when running multiple tasks on the same provider.
 */
import { MarketOrderSpec, GolemNetwork, LifecycleFunction } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

const order: MarketOrderSpec = {
  demand: {
    workload: {
      imageTag: "golem/examples-openssl:latest",
    },
  },
  market: {
    rentHours: 0.5,
    pricing: {
      model: "linear",
      maxStartPrice: 0.5,
      maxCpuPerHourPrice: 1.0,
      maxEnvPerHourPrice: 0.5,
    },
  },
};

/**
 * Let's decrypt these messages in parallel on multiple providers.
 * We know that the messages were encrypted using the aes-256-cbc algorithm
 * with 5000000 iterations and the password "golemnetwork".
 */
const secretMessages = `
U2FsdGVkX18S4g4iyUzjfqIwP/cGppD86mrVQ0kYerfSe3OnGORuU4nYLG6WXy5KG6vLVLq1N/jnyrwkT8yEBA==
U2FsdGVkX1+jEgVgmS+xu37tT5OHieX8cioZHPyjUTh+YodWf0In3DaqtFcEfw2cLHIBd94s4nEmONHCs9x4Rg==
U2FsdGVkX1+JU+fBsnKEGZHGoQpEY/DqlnbCQVg+KgLtkFbtjuHpQbMjnb7iBuj4o4yIYU00jM67+gqn89hrNA==
U2FsdGVkX1897oplQ7utV9zpx/86GABjUP29Xr/GsahKQ9eRv9GgnzW9BCqHKiFjiB2q2F6gCJINspbuiFY+Fg==
U2FsdGVkX183p8EUPOZj/QZFQSeIeYNSSfHcRrBF0NXSJ4RfibvT5HtJJ/5I9fVpc1XpbLwDsCW2yFdQKSzbXA==
U2FsdGVkX184PQiKxx8Sfvl+BOy9JYrBQqdMxWEDc3GBDkEb3qYCWL7FPxZpCEwoZ10MpvY1EKb4lMMxWth6bw==
U2FsdGVkX1/ujngC/IwK8UAvj41t/FbSHVFiiXI7+KeHoKW3HKcwZYb0E+nncpPC6ZT0DgWLzvDaUyBqOS+tkA==
U2FsdGVkX19GNHf4ORUAy2PC3MMnvjx7aZSRNSqkW20fZ03Dc2OnZEWBDPa1J4yx
U2FsdGVkX18iL21PNCohSdFuIOufknLXmINnYf3q15Fl+1vFcRnmC8b9zcrob5Iz/9dNkvrgAeNFmAwWK0bwPw==
U2FsdGVkX18jQbGQ7KTAaRask5efrXEWvvGhe4jQ0MT9mwwH4ULjvoWDm1mNlsjYtb1nRt0O6iBd4O9moHLbbg==
`.trim();

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      // for this example we disable info logs to better show the output
      level: "warn",
    }),
  });

  try {
    await glm.connect();

    // I want to upload my encrypted messages to the provider before I start working
    const setup: LifecycleFunction = async (exe) =>
      exe
        .run(`echo "${secretMessages}" > /golem/work/encrypted-messages.txt`)
        .then(() => console.log("Uploaded the encrypted messages to the provider %s", exe.provider.name));

    // I want to remove the encrypted messages from the provider after I finish working
    const teardown: LifecycleFunction = async (exe) =>
      exe
        .run("rm /golem/work/encrypted-messages.txt")
        .then(() => console.log("Removed the encrypted messages from the provider %s", exe.provider.name));

    const pool = await glm.manyOf({
      poolSize: { max: 3 }, // I want to decrypt in parallel on a maximum of 3 machines simultaneously
      order,
      setup,
      teardown,
    });

    // map each message to a decryption task
    const decryptionTasks = new Array(10).fill(null).map((_, i) =>
      pool.withRental(async (rental) => {
        const exe = await rental.getExeUnit();
        const result = await exe.run(
          `sed '${i + 1}!d' /golem/work/encrypted-messages.txt | \
              openssl \
                enc -aes-256-cbc -d -a \
                -pass pass:golemnetwork \
                -iter 5000000`,
        );
        console.log("Finished decrypting message #%s on the provider %s", i + 1, exe.provider.name);
        return String(result.stdout).trim();
      }),
    );
    const decryptedMessages = await Promise.all(decryptionTasks);
    await pool.drainAndClear();

    console.log("Decrypted messages:");
    for (const message of decryptedMessages) {
      // display the decrypted messages in light-blue color
      console.log("\x1b[36m%s\x1b[0m", message);
    }
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
