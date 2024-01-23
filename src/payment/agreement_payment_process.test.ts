import { AgreementPaymentProcess } from "./agreement_payment_process";
import { anything, instance, mock, objectContaining, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { Agreement } from "../agreement";
import { Allocation } from "./allocation";
import { Invoice } from "./invoice";
import { InvoiceStatus } from "ya-ts-client/dist/ya-payment";
import { RejectionReason } from "./rejection";
import { DebitNote } from "./debit_note";
import { GolemPaymentError, PaymentErrorCode } from "./error";

const agreementMock = mock(Agreement);
const allocationMock = mock(Allocation);
const invoiceMock = mock(Invoice);
const debitNoteMock = mock(DebitNote);

beforeEach(() => {
  reset(agreementMock);
  reset(allocationMock);
  reset(invoiceMock);
  reset(debitNoteMock);
  const testProviderInfo = {
    id: "test-provider-id",
    name: "test-provider-name",
    walletAddress: "0x1234",
  };
  when(agreementMock.getProviderInfo()).thenReturn(testProviderInfo);
});

describe("AgreementPaymentProcess", () => {
  describe("Accepting Invoices", () => {
    describe("Basic use cases", () => {
      it("accepts a invoice in RECEIVED state", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(invoiceMock.amount).thenReturn(0.123);
        when(invoiceMock.getStatus()).thenResolve(InvoiceStatus.Received);

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const success = await process.addInvoice(instance(invoiceMock));

        expect(success).toEqual(true);
        verify(invoiceMock.accept(0.123, "1000")).called();
        expect(process.isFinished()).toEqual(true);
      });

      it("rejects invoice if it's ignored by the user defined invoice filter", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(invoiceMock.id).thenReturn("invoice-id");
        when(invoiceMock.agreementId).thenReturn("agreement-id");
        when(invoiceMock.amount).thenReturn(0.123);
        when(invoiceMock.getStatus()).thenResolve(InvoiceStatus.Received);

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
              message: "Invoice invoice-id for agreement agreement-id rejected by Invoice Filter",
              totalAmountAccepted: "0",
            }),
          ),
        ).called();
        expect(process.isFinished()).toEqual(true);
      });

      it("throws an error when invoice in a state different than RECEIVED", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(invoiceMock.id).thenReturn("invoice-id");
        when(invoiceMock.agreementId).thenReturn("agreement-id");
        when(invoiceMock.amount).thenReturn(0.123);
        when(invoiceMock.getStatus()).thenResolve(InvoiceStatus.Accepted);
        const allocation = instance(allocationMock);

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });
        const invoice = instance(invoiceMock);
        await expect(() => process.addInvoice(invoice)).rejects.toThrow(
          new GolemPaymentError(
            "The invoice invoice-id for agreement agreement-id has status ACCEPTED, but we can accept only the ones with status RECEIVED",
            PaymentErrorCode.InvoiceAlreadyReceived,
            allocation,
            invoice.provider,
          ),
        );

        verify(invoiceMock.accept(0.123, "1000")).never();
        expect(process.isFinished()).toEqual(false);
      });
    });

    describe("Dealing with duplicates", () => {
      it("accepts the duplicated invoice if accepting the previous one failed", async () => {
        when(allocationMock.id).thenReturn("1000");
        const allocation = instance(allocationMock);

        when(invoiceMock.amount).thenReturn(0.123);
        when(invoiceMock.getStatus()).thenResolve(InvoiceStatus.Received);
        when(invoiceMock.isSameAs(anything())).thenReturn(true);

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);

        // Simulate issue with accepting the first one
        const issue = new Error("Failed to accept in yagna");
        when(invoiceMock.accept(0.123, "1000"))
          .thenReject(issue) // On first call
          .thenResolve(); // On second call

        await expect(() => process.addInvoice(invoice)).rejects.toThrow(issue);

        // Then simulate the duplicate coming again
        const success = await process.addInvoice(invoice);

        expect(success).toEqual(true);
        verify(invoiceMock.accept(0.123, "1000")).twice();
        expect(process.isFinished()).toEqual(true);
      });

      it("accepts the duplicate if the original invoice has not been already decided upon (still in RECEIVED state)", async () => {
        when(allocationMock.id).thenReturn("1000");

        when(invoiceMock.amount).thenReturn(0.123);
        when(invoiceMock.getStatus()).thenResolve(InvoiceStatus.Received);
        when(invoiceMock.isSameAs(anything())).thenReturn(true);

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);

        when(invoiceMock.accept(0.123, "1000")).thenResolve();

        const firstSuccess = await process.addInvoice(invoice);
        const secondSuccess = await process.addInvoice(invoice);

        expect(firstSuccess).toEqual(true);
        expect(secondSuccess).toEqual(true);
        verify(invoiceMock.accept(0.123, "1000")).twice();
        expect(process.isFinished()).toEqual(true);
      });

      it("doesn't accept the same invoice twice if the previous one was already processed", async () => {
        when(invoiceMock.getStatus()).thenResolve(InvoiceStatus.Received).thenResolve(InvoiceStatus.Accepted);
        when(invoiceMock.isSameAs(anything())).thenReturn(true);

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);

        const firstSuccess = await process.addInvoice(invoice);
        const secondSuccess = await process.addInvoice(invoice);

        expect(firstSuccess).toEqual(true);
        expect(secondSuccess).toEqual(false);
        expect(process.isFinished()).toEqual(true);
      });
    });

    describe("Security", () => {
      it("throws an error when there's already an invoice present, and a different one is passed to the process", async () => {
        when(invoiceMock.id).thenReturn("invoice-id");
        when(invoiceMock.agreementId).thenReturn("agreement-id");
        when(agreementMock.id).thenReturn("agreement-id");
        when(invoiceMock.getStatus()).thenResolve(InvoiceStatus.Received);
        when(invoiceMock.isSameAs(anything())).thenReturn(false);

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);

        const sucess = await process.addInvoice(invoice);

        expect(sucess).toEqual(true);
        await expect(() => process.addInvoice(invoice)).rejects.toThrow(
          "Agreement agreement-id is already covered with an invoice: invoice-id",
        );
        expect(process.isFinished()).toEqual(true);
      });
    });
  });

  describe("Accepting DebitNotes", () => {
    describe("Basic use cases", () => {
      it("accepts a single debit note", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(debitNoteMock.totalAmountDue).thenReturn(0.123);

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const debitNote = instance(debitNoteMock);

        const success = await process.addDebitNote(debitNote);

        expect(success).toEqual(true);
        verify(debitNoteMock.accept(0.123, "1000")).called();
        expect(process.isFinished()).toEqual(false);
      });

      it("rejects debit note if it's ignored by the user defined debit note filter", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(debitNoteMock.totalAmountDue).thenReturn(0.123);
        when(debitNoteMock.id).thenReturn("debit-note-id");
        when(debitNoteMock.agreementId).thenReturn("agreement-id");

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
              message: "DebitNote debit-note-id for agreement agreement-id rejected by DebitNote Filter",
              totalAmountAccepted: "0",
            }),
          ),
        ).called();
        expect(process.isFinished()).toEqual(false);
      });

      it("rejects debit note if there is already an invoice for that process", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(invoiceMock.amount).thenReturn(0.123);
        when(invoiceMock.getStatus()).thenResolve(InvoiceStatus.Received);
        when(debitNoteMock.totalAmountDue).thenReturn(0.456);
        when(debitNoteMock.id).thenReturn("debit-note-id");
        when(debitNoteMock.agreementId).thenReturn("agreement-id");

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);
        const debitNote = instance(debitNoteMock);

        const invoiceSuccess = await process.addInvoice(invoice);
        const debitNoteSuccess = await process.addDebitNote(debitNote);

        expect(invoiceSuccess).toEqual(true);
        verify(invoiceMock.accept(0.123, "1000")).called();

        expect(debitNoteSuccess).toEqual(false);
        verify(
          debitNoteMock.reject(
            objectContaining({
              rejectionReason: RejectionReason.AgreementFinalized,
              message:
                "DebitNote debit-note-id rejected because the agreement agreement-id is already covered with a final invoice that should be paid instead of the debit note",
              totalAmountAccepted: "0",
            }),
          ),
        ).called();
        expect(process.isFinished()).toEqual(true);
      });
    });

    describe("Dealing with duplicates", () => {
      it("accepts the duplicated debit note if accepting the previous failed", async () => {
        when(allocationMock.id).thenReturn("1000");
        when(debitNoteMock.totalAmountDue).thenReturn(0.123);
        when(debitNoteMock.getStatus()).thenResolve(InvoiceStatus.Received);

        const process = new AgreementPaymentProcess(instance(agreementMock), instance(allocationMock), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const debitNote = instance(debitNoteMock);

        // Simulate issue with accepting the first one
        const issue = new Error("Failed to accept in yagna");
        when(debitNoteMock.accept(0.123, "1000"))
          .thenReject(issue) // On first call
          .thenResolve(); // On second call

        await expect(() => process.addDebitNote(debitNote)).rejects.toThrow(issue);

        // Then simulate the duplicate coming again
        const success = await process.addDebitNote(debitNote);

        expect(success).toEqual(true);
        verify(debitNoteMock.accept(0.123, "1000")).twice();
        expect(process.isFinished()).toEqual(false);
      });

      it("doesn't accept the same debit note twice if the previous one was already processed", async () => {
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
