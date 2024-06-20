/**
 * This example demonstrates how to use payment filters to prevent auto-accepting
 * invoices and debit notes that don't meet certain criteria.
 */
import { MarketOrderSpec, GolemNetwork, InvoiceFilter, DebitNoteFilter } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

/* let's create a sample filter that doesn't accept invoices if
 * the payable amount is higher than 1000 GLM.
 * Be careful when processing floating point numbers in JavaScript, as they can
 * be imprecise. For this reason, we recommend using a library like decimal.js-light.
 * `invoice.getPreciseAmount()` is a method that returns the amount as a Decimal object.
 */
const invoiceFilter: InvoiceFilter = async (invoice) => {
  console.debug(
    "Invoice %s for %s GLM is passing through the filter",
    invoice.id,
    invoice.getPreciseAmount().toFixed(6),
  );
  return invoice.getPreciseAmount().lte(1000);
};

/* Let's create another sample filter. This time we will get the demand that
 * the debit note is related to from the provided context and compare the payment platforms.
 */
const debitNoteFilter: DebitNoteFilter = async (debitNote, context) => {
  console.debug(
    "Debit Note %s for %s GLM is passing through the filter",
    debitNote.id,
    debitNote.getPreciseAmount().toFixed(6),
  );
  return debitNote.paymentPlatform === context.demand.paymentPlatform;
};

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
  // Here's where we specify the payment filters
  payment: {
    debitNoteFilter,
    invoiceFilter,
  },
};

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
  });

  try {
    await glm.connect();
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
