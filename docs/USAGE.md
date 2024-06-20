# Usage

## Table of Contents

<!-- TOC -->

- [Usage](#usage)
  - [Table of Contents](#table-of-contents)
  - [Renting a single machine and running a simple task on it](#renting-a-single-machine-and-running-a-simple-task-on-it)
  - [Renting many machines and running tasks in parallel](#renting-many-machines-and-running-tasks-in-parallel)
  <!-- TOC -->

## Renting a single machine and running a simple task on it

```ts
import { MarketOrderSpec, GolemNetwork } from "@golem-sdk/golem-js";

// Define the order that we're going to place on the market
const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
  },
  market: {
    // We're only going to rent the provider for 5 minutes max
    rentHours: 5 / 60,
    pricing: {
      model: "linear",
      maxStartPrice: 0.5,
      maxCpuPerHourPrice: 1.0,
      maxEnvPerHourPrice: 0.5,
    },
  },
};

(async () => {
  const glm = new GolemNetwork();

  try {
    await glm.connect();
    // Rent a machine
    const rental = await glm.oneOf(order);
    await rental
      .getExeUnit()
      .then((exe) => exe.run("echo Hello, Golem! 👋"))
      .then((res) => console.log(res.stdout));
    await rental.stopAndFinalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
```

## Renting many machines and running tasks in parallel

```ts
import { GolemNetwork, MarketOrderSpec } from "@golem-sdk/golem-js";

// Define the order that we're going to place on the market
const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
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

(async () => {
  const glm = new GolemNetwork();

  try {
    await glm.connect();
    // create a pool that can grow up to 3 rentals at the same time
    const pool = await glm.manyOf({
      concurrency: 3,
      order,
    });
    // run 3 tasks in parallel on 3 different machines
    await Promise.allSettled([
      pool.withRental(async (rental) =>
        rental
          .getExeUnit()
          .then((exe) => exe.run("echo Hello, Golem from the first machine! 👋"))
          .then((res) => console.log(res.stdout)),
      ),
      pool.withRental(async (rental) =>
        rental
          .getExeUnit()
          .then((exe) => exe.run("echo Hello, Golem from the second machine! 👋"))
          .then((res) => console.log(res.stdout)),
      ),
      pool.withRental(async (rental) =>
        rental
          .getExeUnit()
          .then((exe) => exe.run("echo Hello, Golem from the third machine! 👋"))
          .then((res) => console.log(res.stdout)),
      ),
    ]);
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
```
