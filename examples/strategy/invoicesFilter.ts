import { TaskExecutor, PaymentFilters } from "yajsapi";

/**
 * Example demonstrating how to use the predefined payment filter `acceptMaxAmountInvoiceFilter`,
 * which only accept invoices below 0.00001 GLM.
 */
(async function main() {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    invoiceFilter: PaymentFilters.acceptMaxAmountInvoiceFilter(0.00001),
  });
  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})();
