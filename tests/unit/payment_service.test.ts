import { clear, setExpectedDebitNotes, setExpectedEvents, setExpectedInvoices } from "../mock/rest/payment";
import { LoggerMock, YagnaMock } from "../mock";
import { Allocation, PaymentFilters, PaymentService } from "../../src/payment";
import { agreement } from "../mock/entities/agreement";
import { debitNotes, debitNotesEvents, invoiceEvents, invoices } from "../mock/fixtures";

const logger = new LoggerMock();
const yagnaApi = new YagnaMock().getApi();

/**
 * service.end() waits for invoices to be paid, in unit-tests that should be below 5s
 */
const TEST_PAYMENT_TIMEOUT_MS = 1000;

describe("Payment Service", () => {
  beforeEach(() => {
    logger.clear();
    clear();
  });

  describe("Allocations", () => {
    it("should create allocation", async () => {
      const paymentService = new PaymentService(yagnaApi);
      const allocation = await paymentService.createAllocation();
      expect(allocation).toBeInstanceOf(Allocation);
      await paymentService.end();
    });

    it("should release created allocation when service stopped", async () => {
      const paymentService = new PaymentService(yagnaApi, { logger });
      const allocation = await paymentService.createAllocation();
      const releaseSpy = jest.spyOn(allocation, "release");
      await paymentService.end();
      expect(releaseSpy).toHaveBeenCalled();
    });
  });

  describe("Processing payments", () => {
    it("should accept and process invoice for agreement", async () => {
      const paymentService = new PaymentService(yagnaApi, {
        logger,
        paymentTimeout: TEST_PAYMENT_TIMEOUT_MS,
      });
      setExpectedEvents(invoiceEvents);
      setExpectedInvoices(invoices);
      await paymentService.createAllocation();
      await paymentService.run();
      paymentService.acceptPayments(agreement);

      await logger.expectToInclude(
        `Invoice ${invoices[0].invoiceId} for agreement ${agreement.id} from provider ${agreement.provider.name} has been accepted`,
        1_000,
      );
      await paymentService.end();
    });

    it("should accept and process debit note for agreement", async () => {
      const paymentService = new PaymentService(yagnaApi, {
        logger,
        paymentTimeout: TEST_PAYMENT_TIMEOUT_MS,
      });
      setExpectedEvents(debitNotesEvents);
      setExpectedDebitNotes(debitNotes);
      await paymentService.createAllocation();
      paymentService.acceptPayments(agreement);
      await paymentService.run();
      await logger.expectToInclude(
        `DebitNote ${debitNotes[0].debitNoteId} accepted for agreement ${agreement.id}`,
        1_000,
      );
      await paymentService.end();
    });

    it("should reject when debit note rejected by DebitNote Filter", async () => {
      const alwaysRejectDebitNoteFilter = async () => false;
      const paymentService = new PaymentService(yagnaApi, {
        logger,
        debitNotesFilter: alwaysRejectDebitNoteFilter,
        paymentTimeout: TEST_PAYMENT_TIMEOUT_MS,
      });
      setExpectedEvents(debitNotesEvents);
      setExpectedDebitNotes(debitNotes);
      await paymentService.createAllocation();
      await paymentService.acceptPayments(agreement);
      await paymentService.run();
      await logger.expectToInclude(
        `DebitNote rejected with reason: DebitNote ${debitNotes[0].debitNoteId} for agreement ${agreement.id} rejected by DebitNote Filter`,
        100,
      );
      await paymentService.end();
    });

    it("should reject a debit note when the agreement is already covered with a final invoice", async () => {
      const paymentService = new PaymentService(yagnaApi, {
        logger,
      });

      setExpectedEvents([...invoiceEvents, ...debitNotesEvents]);
      setExpectedDebitNotes(debitNotes);
      setExpectedInvoices(invoices);
      await paymentService.createAllocation();
      await paymentService.acceptPayments(agreement);
      await paymentService.run();
      await logger.expectToInclude(
        `DebitNote rejected with reason: DebitNote ${debitNotes[0].debitNoteId} rejected because the agreement ${agreement.id} is already covered with a final invoice that should be paid instead of the debit note`,
        100,
      );
      await paymentService.end();
    });

    it("should reject when invoice rejected by Invoice Filter", async () => {
      const alwaysRejectInvoiceFilter = async () => false;
      const paymentService = new PaymentService(yagnaApi, {
        logger,
        invoiceFilter: alwaysRejectInvoiceFilter,
        paymentTimeout: TEST_PAYMENT_TIMEOUT_MS,
      });
      setExpectedEvents(invoiceEvents);
      setExpectedInvoices(invoices);
      await paymentService.createAllocation();
      paymentService.acceptPayments(agreement);
      await paymentService.run();
      await logger.expectToInclude(
        `Invoice rejected with reason: Invoice ${invoices[0].invoiceId} for agreement ${agreement.id} rejected by Invoice Filter`,
        1_000,
      );
      await paymentService.end();
    });

    it("should reject when debit note rejected by DebitNoteMaxAmount Filter", async () => {
      const paymentService = new PaymentService(yagnaApi, {
        logger,
        debitNotesFilter: PaymentFilters.acceptMaxAmountDebitNoteFilter(0.00001),
        paymentTimeout: TEST_PAYMENT_TIMEOUT_MS,
      });
      setExpectedEvents(debitNotesEvents);
      setExpectedDebitNotes(debitNotes);
      await paymentService.createAllocation();
      await paymentService.acceptPayments(agreement);
      await paymentService.run();
      await logger.expectToInclude(
        `DebitNote rejected with reason: DebitNote ${debitNotes[0].debitNoteId} for agreement ${agreement.id} rejected by DebitNote Filter`,
        100,
      );
      await paymentService.end();
    });

    it("should reject when invoice rejected by MaxAmountInvoice Filter", async () => {
      const paymentService = new PaymentService(yagnaApi, {
        logger,
        invoiceFilter: PaymentFilters.acceptMaxAmountInvoiceFilter(0.00001),
        paymentTimeout: TEST_PAYMENT_TIMEOUT_MS,
      });
      setExpectedEvents(invoiceEvents);
      setExpectedInvoices(invoices);
      await paymentService.createAllocation();
      paymentService.acceptPayments(agreement);
      await paymentService.run();

      await logger.expectToInclude(
        `Invoice rejected with reason: Invoice ${invoices[0].invoiceId} for agreement ${agreement.id} rejected by Invoice Filter`,
        100,
      );
      await paymentService.end();
    });

    it("should accept when debit note filtered by DebitNoteMaxAmount Filter", async () => {
      const paymentService = new PaymentService(yagnaApi, {
        logger,
        debitNotesFilter: PaymentFilters.acceptMaxAmountDebitNoteFilter(7),
        paymentTimeout: TEST_PAYMENT_TIMEOUT_MS,
      });
      setExpectedEvents(debitNotesEvents);
      setExpectedDebitNotes(debitNotes);
      await paymentService.createAllocation();
      await paymentService.acceptPayments(agreement);
      await paymentService.run();
      await logger.expectToInclude(
        `DebitNote ${debitNotes[0].debitNoteId} accepted for agreement ${agreement.id}`,
        1_000,
      );
      await paymentService.end();
    });

    it("should accept when invoice filtered by MaxAmountInvoice Filter", async () => {
      const paymentService = new PaymentService(yagnaApi, {
        logger,
        invoiceFilter: PaymentFilters.acceptMaxAmountInvoiceFilter(7),
      });
      setExpectedEvents(invoiceEvents);
      setExpectedInvoices(invoices);
      await paymentService.createAllocation();
      await paymentService.run();
      paymentService.acceptPayments(agreement);

      await logger.expectToInclude(
        `Invoice ${invoices[0].invoiceId} for agreement ${agreement.id} from provider ${agreement.provider.name} has been accepted`,
        1_000,
      );
      await paymentService.end();
    });
  });
});
