import { TaskExecutor, PaymentFilters } from "@golem-sdk/golem-js";

/**
 * Example demonstrating how to use the predefined payment filter `acceptMaxAmountInvoiceFilter`,
 * which only accept invoices below 0.00001 GLM.
 */
(async function main() {
  const executor = await TaskExecutor.create({
    package: "golem/alpine:latest",
    invoiceFilter: PaymentFilters.acceptMaxAmountInvoiceFilter(0.00001),
  });
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.shutdown();
})();
