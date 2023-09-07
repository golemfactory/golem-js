import { TaskExecutor, PaymentFilters } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to use the predefined payment filter `acceptMaxAmountDebitNoteFilter`,
 * which only accept debit notes below 0.00001 GLM.
 */
(async function main() {
  const executor = await TaskExecutor.create({
    package: "golem/alpine:latest",
    debitNotesFilter: PaymentFilters.acceptMaxAmountDebitNoteFilter(0.00001),
  });
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})();
