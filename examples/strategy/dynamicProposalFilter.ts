/**
 * Example demonstrating how to write a custom dynamic proposal filter.
 *
 * By dynamic, we understand that the filter behaviour might change over time  due to some conditions
 */

import { ProposalFilter, ProposalFilterFactory, TaskExecutor } from "@golem-sdk/golem-js";

const makeDynamicFilter: () => {
  filter: ProposalFilter;
  stopPolling: () => void;
} = () => {
  let partnerProviderIds = [];

  const loadPartners = () =>
    fetch("https://provider-health.golem.network/v1/provider-whitelist")
      .then((res) => res.json())
      .then((list) => (partnerProviderIds = list))
      .catch((err) => console.error("Issue when loading list of partners", err));

  // Update your list of partners each 10s
  const interval = setInterval(loadPartners, 10_000);

  // Fire the load immediately
  void loadPartners();

  // Return the filter that will be called synchronously
  return {
    filter: ProposalFilterFactory.allowProvidersById(partnerProviderIds),
    stopPolling: () => clearInterval(interval),
  };
};

(async function main() {
  const { filter, stopPolling } = makeDynamicFilter();
  const executor = await TaskExecutor.create({
    package: "golem/alpine:latest",
    proposalFilter: filter,
  });
  try {
    await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  } catch (err) {
    console.error("Task execution failed:", err);
  } finally {
    await executor.shutdown();
    stopPolling();
  }
})();
