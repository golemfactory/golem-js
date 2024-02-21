import { TaskExecutor, ReputationSystem, sleep } from "@golem-sdk/golem-js";

/**
 * This example runs multiple test on **polygon** in order to test the reputation quality.
 */

interface RunConfig {
  count: number;
  name: string;
  reputation?: ReputationSystem;
  filterThreshold?: number;
  maxParallelTasks?: number;
}

interface RunResult {
  success: number;
  failure: number;
  time: number;
  providerIdSet: Set<string>;
  walletAddressSet: Set<string>;
}

interface RunStatus {
  config: RunConfig;
  result: RunResult;
}

async function runTests(config: RunConfig): Promise<RunResult> {
  const name = config.name;
  const start = performance.now();
  console.log(`Starting tests ${name} reputation...`);
  const providerIdSet = new Set<string>();
  const walletAddressSet = new Set<string>();
  const executor = await TaskExecutor.create({
    payment: { network: "polygon" },
    package: "golem/alpine:latest",
    proposalFilter: config.reputation
      ? config.reputation.proposalFilter({
          min: config.filterThreshold ?? 0.8,
        })
      : undefined,
    maxTaskRetries: 0,
    maxParallelTasks: config.maxParallelTasks ?? 100,
  });

  const promises: Promise<void>[] = [];
  for (let i = 0; i < config.count; i++) {
    console.log(`Running task #${i} ${name}`);
    promises.push(
      executor.run(async (ctx) => {
        const result = await ctx.run("echo 'Hello World'");
        const pi = ctx.activity.getProviderInfo();
        const on = `${pi.id} (${pi.name})`;
        providerIdSet.add(pi.id);
        walletAddressSet.add(pi.walletAddress);
        if (result.result !== "Ok") {
          console.log(`Task #${i} ${name} failed on ${on}`);
          throw new Error("Computation failed: " + result.stdout);
        } else {
          console.log(`Task #${i} ${name} succeeded on ${on}`);
        }
      }),
    );
  }

  const result = await Promise.allSettled(promises);
  const end = performance.now();
  let success = 0;
  let failure = 0;
  result.forEach((res) => {
    if (res.status === "fulfilled") {
      success++;
    } else {
      failure++;
    }
  });

  await executor.shutdown();

  // return [success, failure, end - start];
  return {
    success,
    failure,
    time: end - start,
    providerIdSet,
    walletAddressSet,
  };
}

(async function main() {
  console.log("WARNING: This test always run on polygon, so real costs will occur.");
  console.log("If you do not wish to continue, press Ctrl+C to abort.");
  console.log("The test will start in 5 seconds...");
  await sleep(5, false);

  const reputation = await ReputationSystem.create();

  // Tests specifications.
  const count = 500;
  const configs: RunConfig[] = [
    {
      name: "no-rep",
      count,
    },
    {
      name: "rep-0.8",
      count,
      reputation,
      filterThreshold: 0.8,
    },
    {
      name: "rep-0.9",
      count,
      reputation,
      filterThreshold: 0.9,
    },
    {
      name: "rep-0.95",
      count,
      reputation,
      filterThreshold: 0.95,
    },
  ];

  // Run all tests.
  const status: RunStatus[] = [];
  for (const config of configs) {
    await runTests(config).then((result) => {
      console.log(`Tests ${config.name} completed: success ${result.success}/${config.count}`);
      status.push({
        config,
        result,
      });
    });
  }

  // Display the results.
  console.log("Final results:");
  status.forEach((s) => {
    console.log(
      `\t${s.config.name}: ${s.result.success}/${s.config.count} - ${(s.result.success / s.config.count) * 100}% in ${(s.result.time / 1000).toFixed(1)}s`,
    );
    console.log(`\t\tDistinct providers: ${s.result.providerIdSet.size}`);
    console.log(`\t\tDistinct wallets: ${s.result.walletAddressSet.size}`);
  });
})();
