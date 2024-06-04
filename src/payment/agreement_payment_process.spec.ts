import { AgreementPaymentProcess } from "./agreement_payment_process";
import { anything, imock, instance, mock, reset, spy, verify, when } from "@johanblumenberg/ts-mockito";
import { Agreement } from "../market/agreement";
import { Allocation } from "./allocation";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { GolemPaymentError, PaymentErrorCode } from "./error";
import { GolemUserError } from "../shared/error/golem-error";
import { Subject } from "rxjs";
import { RejectionReason } from "./rejection";
import { PaymentModule } from "./payment.module";

const agreementMock = mock(Agreement);
const allocationMock = mock(Allocation);
const invoiceMock = mock(Invoice);
const debitNoteMock = mock(DebitNote);

const mockPaymentModule = imock<PaymentModule>();

beforeEach(() => {
  reset(agreementMock);
  reset(allocationMock);
  reset(invoiceMock);
  reset(debitNoteMock);
  reset(mockPaymentModule);

  const testProviderInfo = {
    id: "test-provider-id",
    name: "test-provider-name",
    walletAddress: "0x1234",
  };

  when(agreementMock.getProviderInfo()).thenReturn(testProviderInfo);
  when(invoiceMock.provider).thenReturn(testProviderInfo);
  when(mockPaymentModule.observeInvoices()).thenReturn(new Subject());
  when(mockPaymentModule.observeDebitNotes()).thenReturn(new Subject());
});

describe("AgreementPaymentProcess", () => {
  describe("Accepting Invoices", () => {
    describe("Basic use cases", () => {
      it("accepts a invoice in RECEIVED state", async () => {
        const allocation = instance(allocationMock);

        when(invoiceMock.amount).thenReturn("0.123");
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentModule), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);
        const success = await process.addInvoice(invoice);

        expect(success).toEqual(true);
        verify(mockPaymentModule.acceptInvoice(invoice, allocation, "0.123")).called();
        expect(process.isFinished()).toEqual(true);
      });

      it("rejects invoice if it's ignored by the user defined invoice filter", async () => {
        when(invoiceMock.id).thenReturn("invoice-id");
        when(invoiceMock.agreementId).thenReturn("agreement-id");
        when(invoiceMock.amount).thenReturn("0.123");
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");

        const process = new AgreementPaymentProcess(
          instance(agreementMock),
          instance(allocationMock),
          instance(mockPaymentModule),
          {
            debitNoteFilter: () => true,
            invoiceFilter: () => false,
          },
        );

        const invoice = instance(invoiceMock);
        const success = await process.addInvoice(invoice);

        expect(success).toEqual(false);
        verify(
          mockPaymentModule.rejectInvoice(
            invoice,
            "Invoice invoice-id for agreement agreement-id rejected by Invoice Filter",
          ),
        ).called();
        expect(process.isFinished()).toEqual(true);
      });

      it("throws an error when invoice in a state different than RECEIVED", async () => {
        when(invoiceMock.id).thenReturn("invoice-id");
        when(invoiceMock.agreementId).thenReturn("agreement-id");
        when(invoiceMock.amount).thenReturn("0.123");
        when(invoiceMock.getStatus()).thenReturn("ACCEPTED");
        const allocation = instance(allocationMock);

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentModule), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });
        const invoice = instance(invoiceMock);

        await expect(() => process.addInvoice(invoice)).rejects.toMatchError(
          new GolemPaymentError(
            "The invoice invoice-id for agreement agreement-id has status ACCEPTED, but we can accept only the ones with status RECEIVED",
            PaymentErrorCode.InvoiceAlreadyReceived,
            allocation,
            invoice.provider,
          ),
        );

        verify(mockPaymentModule.acceptInvoice(invoice, allocation, "0.123")).never();
        expect(process.isFinished()).toEqual(false);
      });
    });

    describe("Dealing with duplicates", () => {
      it("doesn't accept the second invoice", async () => {
        const allocation = instance(allocationMock);

        when(invoiceMock.id).thenReturn("invoice-id");
        when(invoiceMock.amount).thenReturn("0.123");
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");

        when(agreementMock.id).thenReturn("agreement-id");

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentModule), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice1 = instance(invoiceMock);
        const invoice2 = instance(invoiceMock);

        const firstSuccess = await process.addInvoice(invoice1);
        expect(firstSuccess).toEqual(true);
        await expect(() => process.addInvoice(invoice2)).rejects.toMatchError(
          new GolemPaymentError(
            "Agreement agreement-id is already covered with an invoice: invoice-id",
            PaymentErrorCode.AgreementAlreadyPaid,
            allocation,
            invoice1.provider,
          ),
        );
      });
    });

    describe("Security", () => {
      it("throws an error when there's already an invoice present, and a different one is passed to the process", async () => {
        when(invoiceMock.id).thenReturn("invoice-id");
        when(invoiceMock.agreementId).thenReturn("agreement-id");
        when(agreementMock.id).thenReturn("agreement-id");
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");
        when(invoiceMock.isSameAs(anything())).thenReturn(false);
        const allocation = instance(allocationMock);
        const agreement = instance(agreementMock);

        const process = new AgreementPaymentProcess(agreement, allocation, instance(mockPaymentModule), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);

        const success = await process.addInvoice(invoice);

        expect(success).toEqual(true);
        await expect(() => process.addInvoice(invoice)).rejects.toMatchError(
          new GolemPaymentError(
            "Agreement agreement-id is already covered with an invoice: invoice-id",
            PaymentErrorCode.AgreementAlreadyPaid,
            allocation,
            agreement.getProviderInfo(),
          ),
        );
        expect(process.isFinished()).toEqual(true);
      });
      it("throws an UserError in case of error in the invoice filter", async () => {
        when(invoiceMock.id).thenReturn("invoice-id");
        when(invoiceMock.agreementId).thenReturn("agreement-id");
        when(agreementMock.id).thenReturn("agreement-id");
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");
        when(invoiceMock.isSameAs(anything())).thenReturn(false);
        const allocation = instance(allocationMock);
        const agreement = instance(agreementMock);

        const process = new AgreementPaymentProcess(agreement, allocation, instance(mockPaymentModule), {
          debitNoteFilter: () => true,
          invoiceFilter: () => {
            throw new Error("invoiceFilter error");
          },
        });

        const invoice = instance(invoiceMock);
        await expect(() => process.addInvoice(invoice)).rejects.toMatchError(
          new GolemUserError("An error occurred in the invoice filter", new Error("invoiceFilter error")),
        );
        expect(process.isFinished()).toEqual(true);
      });
    });
  });

  describe("Accepting DebitNotes", () => {
    describe("Basic use cases", () => {
      it("accepts a single debit note", async () => {
        const allocation = instance(allocationMock);

        when(debitNoteMock.totalAmountDue).thenReturn("0.123");

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentModule), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const debitNote = instance(debitNoteMock);

        const success = await process.addDebitNote(debitNote);

        expect(success).toEqual(true);
        verify(mockPaymentModule.acceptDebitNote(debitNote, allocation, "0.123")).called();
        expect(process.isFinished()).toEqual(false);
      });

      // Reason: Debit note rejections are not implemented in yagna yet
      it("rejects debit note if it's ignored by the user defined debit note filter", async () => {
        when(debitNoteMock.totalAmountDue).thenReturn("0.123");

        when(debitNoteMock.id).thenReturn("debit-note-id");
        when(debitNoteMock.agreementId).thenReturn("agreement-id");

        const process = new AgreementPaymentProcess(
          instance(agreementMock),
          instance(allocationMock),
          instance(mockPaymentModule),
          {
            debitNoteFilter: () => false,
            invoiceFilter: () => true,
          },
        );
        const processSpy = spy(process);

        const debitNote = instance(debitNoteMock);

        const success = await process.addDebitNote(debitNote);

        expect(success).toEqual(false);
        verify(
          processSpy["rejectDebitNote"](
            debitNote,
            RejectionReason.RejectedByRequestorFilter,
            "DebitNote debit-note-id for agreement agreement-id rejected by DebitNote Filter",
          ),
        ).called();
        expect(process.isFinished()).toEqual(false);
      });

      // Reason: Debit note rejections are not implemented in yagna yet
      it("rejects debit note if there is already an invoice for that process", async () => {
        const allocation = instance(allocationMock);

        when(invoiceMock.amount).thenReturn("0.123");
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");
        when(debitNoteMock.totalAmountDue).thenReturn("0.456");
        when(debitNoteMock.id).thenReturn("debit-note-id");
        when(debitNoteMock.agreementId).thenReturn("agreement-id");

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentModule), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });
        const processSpy = spy(process);

        const invoice = instance(invoiceMock);
        const debitNote = instance(debitNoteMock);

        const invoiceSuccess = await process.addInvoice(invoice);
        const debitNoteSuccess = await process.addDebitNote(debitNote);

        expect(invoiceSuccess).toEqual(true);
        verify(mockPaymentModule.acceptInvoice(invoice, allocation, "0.123")).called();

        expect(debitNoteSuccess).toEqual(false);
        verify(
          processSpy["rejectDebitNote"](
            debitNote,
            RejectionReason.AgreementFinalized,
            "DebitNote debit-note-id rejected because the agreement agreement-id is already covered with a final invoice that should be paid instead of the debit note",
          ),
        ).called();
        expect(process.isFinished()).toEqual(true);
      });
    });

    describe("Dealing with duplicates", () => {
      it("doesn't accept the same debit note twice if the previous one was already processed", async () => {
        when(debitNoteMock.getStatus()).thenReturn("ACCEPTED");

        const process = new AgreementPaymentProcess(
          instance(agreementMock),
          instance(allocationMock),
          instance(mockPaymentModule),
          {
            debitNoteFilter: () => true,
            invoiceFilter: () => true,
          },
        );

        const debitNote = instance(debitNoteMock);

        const firstSuccess = await process.addDebitNote(debitNote);
        expect(firstSuccess).toEqual(true);

        const secondSuccess = await process.addDebitNote(debitNote);
        expect(secondSuccess).toEqual(false);
        verify(mockPaymentModule.rejectDebitNote(debitNote, anything())).never();
        expect(process.isFinished()).toEqual(false);
      });
    });
    describe("Security", () => {
      it("throws an UserError in case of error in the debitNote filter", async () => {
        when(debitNoteMock.totalAmountDue).thenReturn("0.123");
        when(debitNoteMock.getStatus()).thenReturn("RECEIVED");

        const process = new AgreementPaymentProcess(
          instance(agreementMock),
          instance(allocationMock),
          instance(mockPaymentModule),
          {
            debitNoteFilter: () => {
              throw new Error("debitNoteFilter error");
            },
            invoiceFilter: () => true,
          },
        );

        const debitNote = instance(debitNoteMock);

        await expect(() => process.addDebitNote(debitNote)).rejects.toMatchError(
          new GolemUserError("An error occurred in the debit note filter", new Error("debitNoteFilter error")),
        );
        expect(process.isFinished()).toEqual(false);
      });
    });
  });
});
