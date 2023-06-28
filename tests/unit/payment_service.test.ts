import { setExpectedDebitNotes, setExpectedEvents, setExpectedInvoices, clear } from "../mock/rest/payment.js";
import { expect } from "chai";
import { LoggerMock } from "../mock/index.js";
import { PaymentService, Allocation } from "../../yajsapi/payment/index.js";
import { agreement } from "../mock/entities/agreement.js";
import { debitNotesEvents, debitNotes, invoices, invoiceEvents } from "../mock/fixtures/index.js";

const logger = new LoggerMock();

describe("Payment Service", () => {
  beforeEach(() => {
    logger.clear();
    clear();
  });

  describe("Allocations", () => {
    it("should creating allocations for available accounts", async () => {
      const paymentService = new PaymentService();
      const allocations = await paymentService.createAllocations();
      expect(allocations[0]).to.be.instanceof(Allocation);
      await paymentService.end();
    });

    it("should not creating allocations if there are no available accounts", async () => {
      const paymentService = new PaymentService({ payment: { network: "test2", driver: "test2" } });
      await expect(paymentService.createAllocations()).to.be.rejectedWith(
        "Unable to create allocation for driver/network test2/test2. There is no requestor account supporting this platform."
      );
      await paymentService.end();
    });

    it("should release all created allocations when service stopped", async () => {
      const paymentService = new PaymentService({ logger });
      await paymentService.createAllocations();
      await paymentService.end();
      expect(logger.logs).to.include("All allocations has been released");
    });
  });

  describe("Processing payments", () => {
    it("should accept and process invoice for agreement", async () => {
      const paymentService = new PaymentService({
        logger,
        invoiceFetchingInterval: 10,
        debitNotesFetchingInterval: 10,
        payingInterval: 10,
      });
      setExpectedEvents(invoiceEvents);
      setExpectedInvoices(invoices);
      await paymentService.createAllocations();
      await paymentService.run();
      paymentService.acceptPayments(agreement);
      await new Promise((res) => setTimeout(res, 200));
      await logger.expectToInclude(`Invoice accepted from provider ${agreement.provider.name}`, 100);
      await paymentService.end();
    });

    it("should accept and process debit note for agreement", async () => {
      const paymentService = new PaymentService({
        logger,
        invoiceFetchingInterval: 10,
        debitNotesFetchingInterval: 10,
        payingInterval: 10,
      });
      setExpectedEvents(debitNotesEvents);
      setExpectedDebitNotes(debitNotes);
      await paymentService.createAllocations();
      await paymentService.run();
      await paymentService.acceptDebitNotes(agreement.id);
      await logger.expectToInclude(`Debit Note accepted for agreement ${agreement.id}`, 100);
      await paymentService.end();
    });
  });
});
