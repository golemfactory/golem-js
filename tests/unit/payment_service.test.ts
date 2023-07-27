import { setExpectedDebitNotes, setExpectedEvents, setExpectedInvoices, clear } from "../mock/rest/payment";
import { LoggerMock } from "../mock";
import { PaymentService, Allocation, PaymentFilters } from "../../yajsapi/payment";
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
      expect(allocations[0]).toBeInstanceOf(Allocation);
      await paymentService.end();
    });

    it("should not creating allocations if there are no available accounts", async () => {
      const paymentService = new PaymentService({ payment: { network: "test2", driver: "test2" } });
      await expect(paymentService.createAllocations()).rejects.toThrow(
        "Unable to create allocation for driver/network test2/test2. There is no requestor account supporting this platform."
      );
      await paymentService.end();
    });

    it("should release all created allocations when service stopped", async () => {
      const paymentService = new PaymentService({ logger });
      await paymentService.createAllocations();
      await paymentService.end();
      expect(logger.logs).toContain("All allocations has been released");
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

    it("should reject when debit note rejected by DebitNote Filter", async () => {
      const alwaysRejectDebitNoteFilter = async () => false;
      const paymentService = new PaymentService({
        logger,
        invoiceFetchingInterval: 10,
        debitNotesFetchingInterval: 10,
        payingInterval: 10,
        debitNotesFilter: alwaysRejectDebitNoteFilter,
      });
      setExpectedEvents(debitNotesEvents);
      setExpectedDebitNotes(debitNotes);
      await paymentService.createAllocations();
      await paymentService.run();
      await paymentService.acceptDebitNotes(agreement.id);
      await logger.expectToInclude(
        `DebitNote has been rejected for agreement ${agreement.id}. Reason: DebitNote rejected by DebitNote Filter`,
        100
      );
      await paymentService.end();
    });

    it("should reject when invoice rejected by Invoice Filter", async () => {
      const alwaysRejectInvoiceFilter = async () => false;
      const paymentService = new PaymentService({
        logger,
        invoiceFetchingInterval: 10,
        debitNotesFetchingInterval: 10,
        payingInterval: 10,
        invoiceFilter: alwaysRejectInvoiceFilter,
      });
      setExpectedEvents(invoiceEvents);
      setExpectedInvoices(invoices);
      await paymentService.createAllocations();
      await paymentService.run();
      paymentService.acceptPayments(agreement);
      await new Promise((res) => setTimeout(res, 200));
      await logger.expectToInclude(
        `Invoice has been rejected for provider ${agreement.provider.name}. Reason: Invoice rejected by Invoice Filter`,
        100
      );
      await paymentService.end();
    });

    it("should reject when debit note rejected by DebitNoteMaxAmount Filter", async () => {
      const paymentService = new PaymentService({
        logger,
        invoiceFetchingInterval: 10,
        debitNotesFetchingInterval: 10,
        payingInterval: 10,
        debitNotesFilter: PaymentFilters.acceptMaxAmountDebitNoteFilter(0.00001),
      });
      setExpectedEvents(debitNotesEvents);
      setExpectedDebitNotes(debitNotes);
      await paymentService.createAllocations();
      await paymentService.run();
      await paymentService.acceptDebitNotes(agreement.id);
      await logger.expectToInclude(
        `DebitNote has been rejected for agreement ${agreement.id}. Reason: DebitNote rejected by DebitNote Filter`,
        100
      );
      await paymentService.end();
    });

    it("should reject when invoice rejected by MaxAmountInvoice Filter", async () => {
      const paymentService = new PaymentService({
        logger,
        invoiceFetchingInterval: 10,
        debitNotesFetchingInterval: 10,
        payingInterval: 10,
        invoiceFilter: PaymentFilters.acceptMaxAmountInvoiceFilter(0.00001),
      });
      setExpectedEvents(invoiceEvents);
      setExpectedInvoices(invoices);
      await paymentService.createAllocations();
      await paymentService.run();
      paymentService.acceptPayments(agreement);
      await new Promise((res) => setTimeout(res, 200));
      await logger.expectToInclude(
        `Invoice has been rejected for provider ${agreement.provider.name}. Reason: Invoice rejected by Invoice Filter`,
        100
      );
      await paymentService.end();
    });

    it("should accept when debit note filtered by DebitNoteMaxAmount Filter", async () => {
      const paymentService = new PaymentService({
        logger,
        invoiceFetchingInterval: 10,
        debitNotesFetchingInterval: 10,
        payingInterval: 10,
        debitNotesFilter: PaymentFilters.acceptMaxAmountDebitNoteFilter(7),
      });
      setExpectedEvents(debitNotesEvents);
      setExpectedDebitNotes(debitNotes);
      await paymentService.createAllocations();
      await paymentService.run();
      await paymentService.acceptDebitNotes(agreement.id);
      await logger.expectToInclude(`Debit Note accepted for agreement ${agreement.id}`, 100);
      await paymentService.end();
    });

    it("should accept when invoice filtered by MaxAmountInvoice Filter", async () => {
      const paymentService = new PaymentService({
        logger,
        invoiceFetchingInterval: 10,
        debitNotesFetchingInterval: 10,
        payingInterval: 10,
        invoiceFilter: PaymentFilters.acceptMaxAmountInvoiceFilter(7),
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
  });
});
