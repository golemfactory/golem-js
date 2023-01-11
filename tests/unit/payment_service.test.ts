import { setExpectedDebitNotes, setExpectedEvents, setExpectedInvoices, clear } from "../mock/rest/payment";
import { expect } from "chai";
import { LoggerMock } from "../mock";
import { PaymentService, Allocation } from "../../yajsapi/payment";
import { agreement } from "../mock/entities/agreement";
import { debitNotesEvents, debitNotes, invoices, invoiceEvents } from "../mock/fixtures";

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
      const allocations = await paymentService.createAllocations();
      expect(allocations.length).to.equal(0);
      await paymentService.end();
    });

    it("should release all created allocations when service stopped", async () => {
      const paymentService = new PaymentService({ logger });
      await paymentService.createAllocations();
      await paymentService.end();
      expect(logger.logs).to.include("All allocations has benn released");
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
      await logger.expectToInclude(`Invoice accepted for agreement ${agreement.id}`, 100);
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
