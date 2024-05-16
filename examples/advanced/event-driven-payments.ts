import { GolemNetwork } from "@golem-sdk/golem-js";

(async () => {
  const glm = new GolemNetwork();

  try {
    await glm.connect();

    const allocation = await glm.payment.createAllocation({
      budget: 10,
      expirationSec: 30 * 60, // 30 minutes
    });

    glm.payment.observeDebitNotes().subscribe(async (debitNote) => {
      if (parseFloat(debitNote.totalAmountDue) > 100) {
        await glm.payment.rejectDebitNote(debitNote, "You must be crazy");
      } else {
        await glm.payment.acceptDebitNote(debitNote, allocation, debitNote.totalAmountDue);
      }
    });
  } catch (err) {
    console.error("Error in script", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
