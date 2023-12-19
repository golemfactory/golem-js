import { AgreementPaymentProcess } from "./agreement_payment_process";
import { anything, instance, mock, objectContaining, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { Agreement } from "../agreement";
import { Allocation } from "./allocation";
import { Invoice } from "./invoice";
import { InvoiceStatus } from "ya-ts-client/dist/ya-payment";
import { RejectionReason } from "./rejection";
import { DebitNote } from "./debit_note";

const agreementMock = mock(Agreement);
const allocationMock = mock(Allocation);
const invoiceMock = mock(Invoice);
const debitNoteMock = mock(DebitNote);

beforeEach(() => {
  reset(agreementMock);
  reset(allocationMock);
  reset(invoiceMock);
  reset(debitNoteMock);
});

describe("AgreementPaymentProcess", () => {
  describe("Accepting Invoices", () => {
    describe("Positive cases", () => {
      it("accepts a single invoice", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(invoiceMock.amount).thenReturn("0.123");

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const success = await process.addInvoice(instance(invoiceMock));

        expect(success).toEqual(true);
        verify(invoiceMock.accept("0.123", "1000")).called();
        expect(process.isFinished()).toEqual(true);
      });

      it("rejects invoice if it's ignored by the user defined invoice filter", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(invoiceMock.amount).thenReturn("0.123");

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => false,
        });

        const success = await process.addInvoice(instance(invoiceMock));

        expect(success).toEqual(false);
        verify(
          invoiceMock.reject(
            objectContaining({
              rejectionReason: RejectionReason.RejectedByRequestorFilter,
              message: "Invoice rejected by Invoice Filter",
              totalAmountAccepted: "0",
            }),
          ),
        ).called();
        expect(process.isFinished()).toEqual(true);
      });

      it("accepts the duplicated invoice if the previous one is still not processed", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(invoiceMock.amount).thenReturn("0.123");

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);

        // Simulate issue with accepting the first one
        const issue = new Error("Failed to accept in yagna");
        when(invoiceMock.accept("0.123", "1000"))
          .thenReject(issue) // On first call
          .thenResolve(); // On second call

        await expect(() => process.addInvoice(invoice)).rejects.toThrow(issue);

        // Then simulate the duplicate coming again
        const success = await process.addInvoice(invoice);

        expect(success).toEqual(true);
        verify(invoiceMock.accept("0.123", "1000")).twice();
        expect(process.isFinished()).toEqual(true);
      });
    });

    describe("Negative cases", () => {
      it("doesn't accept the same invoice twice if the previous one was already processed", async () => {
        // TODO: False and no error to not break?
        when(invoiceMock.getStatus()).thenResolve(InvoiceStatus.Accepted);

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);

        const success = await process.addInvoice(invoice);

        expect(success).toEqual(true);
        expect(process.isFinished()).toEqual(true);
        await expect(() => process.addInvoice(invoice)).rejects.toThrow(
          "This agreement is already covered with an invoice",
        );
      });
    });
  });

  describe("Accepting DebitNotes", () => {
    describe("Positive cases", () => {
      test("accepts a single debit note", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(debitNoteMock.totalAmountDue).thenReturn("0.123");

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const debitNote = instance(debitNoteMock);

        const success = await process.addDebitNote(debitNote);

        expect(success).toEqual(true);
        verify(debitNoteMock.accept("0.123", "1000")).called();
        expect(process.isFinished()).toEqual(false);
      });

      test("rejects debit note if it's ignored by the user defined debit note filter", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(debitNoteMock.totalAmountDue).thenReturn("0.123");

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => false,
          invoiceFilter: () => true,
        });

        const debitNote = instance(debitNoteMock);

        const success = await process.addDebitNote(debitNote);

        expect(success).toEqual(false);
        verify(
          debitNoteMock.reject(
            objectContaining({
              rejectionReason: RejectionReason.RejectedByRequestorFilter,
              message: "DebitNote rejected by DebitNote Filter",
              totalAmountAccepted: "0",
            }),
          ),
        ).called();
        expect(process.isFinished()).toEqual(false);
      });

      test("rejects debit note if there is already an invoice for that process", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(invoiceMock.amount).thenReturn("0.123");
        when(debitNoteMock.totalAmountDue).thenReturn("0.456");

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);
        const debitNote = instance(debitNoteMock);

        const invoiceSuccess = await process.addInvoice(invoice);
        const debitNoteSuccess = await process.addDebitNote(debitNote);

        expect(invoiceSuccess).toEqual(true);
        verify(invoiceMock.accept("0.123", "1000")).called();

        expect(debitNoteSuccess).toEqual(false);
        verify(
          debitNoteMock.reject(
            objectContaining({
              rejectionReason: RejectionReason.AgreementFinalized,
              message:
                "DebitNote rejected because the agreement is already covered with a final invoice that should be paid instead of the debit note",
              totalAmountAccepted: "0",
            }),
          ),
        ).called();
        expect(process.isFinished()).toEqual(true);
      });

      test("accepts the duplicated debit note if the previous one is still not processed", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(debitNoteMock.totalAmountDue).thenReturn("0.123");

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const debitNote = instance(debitNoteMock);

        // Simulate issue with accepting the first one
        const issue = new Error("Failed to accept in yagna");
        when(debitNoteMock.accept("0.123", "1000"))
          .thenReject(issue) // On first call
          .thenResolve(); // On second call

        await expect(() => process.addDebitNote(debitNote)).rejects.toThrow(issue);

        // Then simulate the duplicate coming again
        const success = await process.addDebitNote(debitNote);

        expect(success).toEqual(true);
        verify(debitNoteMock.accept("0.123", "1000")).twice();
        expect(process.isFinished()).toEqual(false);
      });

      test("doesn't accept the same debit note twice if the previous one was already processed", async () => {
        when(debitNoteMock.getStatus()).thenResolve(InvoiceStatus.Accepted);

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const debitNote = instance(debitNoteMock);

        const firstSuccess = await process.addDebitNote(debitNote);
        expect(firstSuccess).toEqual(true);

        const secondSuccess = await process.addDebitNote(debitNote);
        expect(secondSuccess).toEqual(false);
        verify(debitNoteMock.reject(anything())).never();
        expect(process.isFinished()).toEqual(false);
      });
    });
  });
});
