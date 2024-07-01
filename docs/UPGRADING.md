# Upgrade Guide

This document describes the breaking changes introduced in each major version of `golem-js` and the necessary steps you need to take to ensure your application continues to work correctly.

## Upgrading from 2.x to 3.x

### Migrating from `TaskExecutor` to `GolemNetwork`

Since the `TaskExecutor` has been removed in this release, you can migrate to the [@golem-sdk/task-executor](https://www.npmjs.com/package/@golem-sdk/task-executor) package as `1.x` of that package is compatible with `golem-js@2.x`.

If you wish to stick to `golem-js`, here are the examples of changes which you need to make:

#### Simple, single-command use cases

Areas where the changes are needed:

- You stop using `TaskExecutor` and switch to `GolemNetwork` instead.
- Be explicit about the expected computation time and pricing strategy so that `golem-js` can estimate the budget.
- You reach for an exe-unit representation with the `ResourceRental.getExeUnit` method and call your commands via the provided `ExeUnit` instance.

**Before:**

```ts
// before
import { TaskExecutor } from "@golem-sdk/golem-js";

(async function main() {
  const executor = await TaskExecutor.create("golem/alpine:latest");
  try {
    await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  } catch (error) {
    console.error("Failed to execute work:", error);
  } finally {
    await executor.shutdown();
  }
})();
```

**After:**

```ts
// after
import { GolemNetwork } from "@golem-sdk/golem-js";

(async function main() {
  const glm = new GolemNetwork();
  try {
    await glm.connect();

    const retnal = await glm.oneOf({
      order: {
        demand: {
          workload: { imageTag: "golem/alpine:latest" },
        },
        // You have to be now explicit about about your terms and expectatios from the market
        market: {
          rentHours: 5 / 60,
          pricing: {
            model: "linear",
            maxStartPrice: 0.5,
            maxCpuPerHourPrice: 1.0,
            maxEnvPerHourPrice: 0.5,
          },
        },
      },
    });

    // You will work with exe-unit objects instead of "executor"
    await rental
      .getExeUnit()
      .then((exe) => exe.run("echo 'Hello World'"))
      .then((res) => console.log(res.stdout));
  } catch (error) {
    console.error("Failed to execute work:", error);
  } finally {
    await glm.disconnect();
  }
})();
```

#### Engaging with many providers at the same time

Areas where the changes are needed:

- instead of using `maxParallelTasks` from `TaskExecutor`, use `poolSize` option on `GolemNetwork.manyOf` market order spec argument.

**Before:**

```ts
// before
import { GolemNetwork } from "@golem-sdk/golem-js";

(async function main() {
  const executor = await GolemNetwork.create({
    imageTag: "golem/alpine:latest",
    // 🔢 Number of max providers which you want to engage with
    maxParallelTasks: 3,
  });

  try {
    const inputs = [1, 2, 3, 4, 5];

    const results = await Promise.allSettled(
      inputs.map((input) => executor.run((ctx) => ctx.run(`echo 'Hello ${input}`))),
    );

    const responses = results.map((p) => (p.status === "fulfilled" ? p.value.stdout : null)).filter((v) => v !== null);

    console.log(responses);
  } catch (error) {
    console.error("Failed to execute work:", error);
  } finally {
    await executor.shutdown();
  }
})();
```

```ts
// after
import { GolemNetwork } from "@golem-sdk/golem-js";

(async function main() {
  const glm = new GolemNetwork();
  try {
    await glm.connect();

    // 🌟 You acquire a pool of ResourceRentals
    const pool = await glm.manyOf({
      // 🔢 Number of max providers which you want to engage with
      poolSize: 3,
      order: {
        demand: {
          workload: { imageTag: "golem/alpine:latest" },
        },
        // You have to be now explicit about about your terms and expectatios from the market
        market: {
          rentHours: 5 / 60,
          pricing: {
            model: "linear",
            maxStartPrice: 0.5,
            maxCpuPerHourPrice: 1.0,
            maxEnvPerHourPrice: 0.5,
          },
        },
      },
    });

    const inputs = [1, 2, 3, 4, 5];

    // You still take the necessary precaucions, pipeline your work and processing
    const results = await Promise.allSettled(
      inputs.map((input) =>
        // 🌟🌟 You access rentals from the pool
        pool.withRental((rental) =>
          rental
            // 🌟🌟🌟 You issue the comands as in case of a single-provider scenario
            .getExeUnit()
            .run(`echo 'Hello ${input}`)
            .then((res) => res.stdout),
        ),
      ),
    );

    // You still filter for the values which succeeded
    const responses = results.map((p) => (p.status === "fulfilled" ? p.value : null)).filter((v) => v !== null);

    console.log(responses);
  } catch (error) {
    console.error("Failed to execute work:", error);
  } finally {
    await glm.disconnect();
  }
})();
```
