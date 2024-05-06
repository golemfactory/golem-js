import { AgreementPaymentProcess } from "./agreement_payment_process";
import { anything, imock, instance, mock, reset, verify, when } from "@johanblumenberg/ts-mockito";
import { Agreement, IPaymentApi } from "../agreement";
import { Allocation } from "./allocation";
import { Invoice } from "./invoice";
import { DebitNote } from "./debit_note";
import { GolemPaymentError, PaymentErrorCode } from "./error";
import { GolemUserError } from "../shared/error/golem-error";

const agreementMock = mock(Agreement);
const allocationMock = mock(Allocation);
const invoiceMock = mock(Invoice);
const debitNoteMock = mock(DebitNote);

const mockPaymentApi = imock<IPaymentApi>();

beforeEach(() => {
  reset(agreementMock);
  reset(allocationMock);
  reset(invoiceMock);
  reset(debitNoteMock);
  reset(mockPaymentApi);

  const testProviderInfo = {
    id: "test-provider-id",
    name: "test-provider-name",
    walletAddress: "0x1234",
  };

  when(agreementMock.getProviderInfo()).thenReturn(testProviderInfo);
  when(invoiceMock.provider).thenReturn(testProviderInfo);
});

describe("AgreementPaymentProcess", () => {
  describe("Accepting Invoices", () => {
    describe("Basic use cases", () => {
      it("accepts a invoice in RECEIVED state", async () => {
        const allocation = instance(allocationMock);

        when(invoiceMock.amount).thenReturn("0.123");
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentApi), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);
        const success = await process.addInvoice(invoice);

        expect(success).toEqual(true);
        verify(mockPaymentApi.acceptInvoice(invoice, allocation, "0.123")).called();
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
          instance(mockPaymentApi),
          {
            debitNoteFilter: () => true,
            invoiceFilter: () => false,
          },
        );

        const invoice = instance(invoiceMock);
        const success = await process.addInvoice(invoice);

        expect(success).toEqual(false);
        verify(
          mockPaymentApi.rejectInvoice(
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

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentApi), {
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

        verify(mockPaymentApi.acceptInvoice(invoice, allocation, "0.123")).never();
        expect(process.isFinished()).toEqual(false);
      });
    });

    // Revisit if that's really possible?
    describe.skip("Dealing with duplicates", () => {
      it("accepts the duplicated invoice if accepting the previous one failed", async () => {
        const allocation = instance(allocationMock);

        when(invoiceMock.amount).thenReturn("0.123");
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");
        when(invoiceMock.isSameAs(anything())).thenReturn(true);

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentApi), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);

        // Simulate issue with accepting the first one
        const issue = new Error("Failed to accept in yagna");
        when(mockPaymentApi.acceptInvoice(invoice, allocation, "0.123"))
          .thenReject(issue) // On first call
          .thenResolve(invoice); // On second call

        await expect(() => process.addInvoice(invoice)).rejects.toThrow(issue);

        // Then simulate the duplicate coming again
        const success = await process.addInvoice(invoice);

        expect(success).toEqual(true);
        verify(mockPaymentApi.acceptInvoice(invoice, allocation, "0.123")).twice();
        expect(process.isFinished()).toEqual(true);
      });

      it("accepts the duplicate if the original invoice has not been already decided upon (still in RECEIVED state)", async () => {
        when(invoiceMock.amount).thenReturn("0.123");
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");
        when(invoiceMock.isSameAs(anything())).thenReturn(true);

        const allocation = instance(allocationMock);

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentApi), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);

        when(mockPaymentApi.acceptInvoice(invoice, allocation, "0.123")).thenResolve(invoice);

        const firstSuccess = await process.addInvoice(invoice);
        const secondSuccess = await process.addInvoice(invoice);

        expect(firstSuccess).toEqual(true);
        expect(secondSuccess).toEqual(true);
        verify(mockPaymentApi.acceptInvoice(invoice, allocation, "0.123")).twice();
        expect(process.isFinished()).toEqual(true);
      });

      it("doesn't accept the same invoice twice if the previous one was already processed", async () => {
        when(invoiceMock.getStatus()).thenReturn("RECEIVED").thenReturn("ACCEPTED");
        when(invoiceMock.isSameAs(anything())).thenReturn(true);

        const process = new AgreementPaymentProcess(
          instance(agreementMock),
          instance(allocationMock),
          instance(mockPaymentApi),
          {
            debitNoteFilter: () => true,
            invoiceFilter: () => true,
          },
        );

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
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");
        when(invoiceMock.isSameAs(anything())).thenReturn(false);
        const allocation = instance(allocationMock);
        const agreement = instance(agreementMock);

        const process = new AgreementPaymentProcess(agreement, allocation, instance(mockPaymentApi), {
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

        const process = new AgreementPaymentProcess(agreement, allocation, instance(mockPaymentApi), {
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

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentApi), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const debitNote = instance(debitNoteMock);

        const success = await process.addDebitNote(debitNote);

        expect(success).toEqual(true);
        verify(mockPaymentApi.acceptDebitNote(debitNote, allocation, "0.123")).called();
        expect(process.isFinished()).toEqual(false);
      });

      // Reason: Debit note rejections are not implemented in yagna yet
      it.skip("rejects debit note if it's ignored by the user defined debit note filter", async () => {
        when(debitNoteMock.totalAmountDue).thenReturn("0.123");

        when(debitNoteMock.id).thenReturn("debit-note-id");
        when(debitNoteMock.agreementId).thenReturn("agreement-id");

        const process = new AgreementPaymentProcess(
          instance(agreementMock),
          instance(allocationMock),
          instance(mockPaymentApi),
          {
            debitNoteFilter: () => false,
            invoiceFilter: () => true,
          },
        );

        const debitNote = instance(debitNoteMock);

        const success = await process.addDebitNote(debitNote);

        expect(success).toEqual(false);
        verify(
          mockPaymentApi.rejectDebitNote(
            debitNote,
            "DebitNote debit-note-id for agreement agreement-id rejected by DebitNote Filter",
          ),
        ).called();
        expect(process.isFinished()).toEqual(false);
      });

      // Reason: Debit note rejections are not implemented in yagna yet
      it.skip("rejects debit note if there is already an invoice for that process", async () => {
        const allocation = instance(allocationMock);

        when(invoiceMock.amount).thenReturn("0.123");
        when(invoiceMock.getStatus()).thenReturn("RECEIVED");
        when(debitNoteMock.totalAmountDue).thenReturn("0.456");
        when(debitNoteMock.id).thenReturn("debit-note-id");
        when(debitNoteMock.agreementId).thenReturn("agreement-id");

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentApi), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        const invoice = instance(invoiceMock);
        const debitNote = instance(debitNoteMock);

        const invoiceSuccess = await process.addInvoice(invoice);
        const debitNoteSuccess = await process.addDebitNote(debitNote);

        expect(invoiceSuccess).toEqual(true);
        verify(mockPaymentApi.acceptInvoice(invoice, allocation, "0.123")).called();

        expect(debitNoteSuccess).toEqual(false);
        verify(
          mockPaymentApi.rejectDebitNote(
            debitNote,
            "DebitNote debit-note-id rejected because the agreement agreement-id is already covered with a final invoice that should be paid instead of the debit note",
          ),
        ).called();
        expect(process.isFinished()).toEqual(true);
      });
    });

    // Verify if that's even possible to get duplicates? Or that's an issue with our reading? At least once delivery?
    describe.skip("Dealing with duplicates", () => {
      it("accepts the duplicated debit note if accepting the previous failed", async () => {
        const allocation = instance(allocationMock);

        when(debitNoteMock.totalAmountDue).thenReturn("0.123");
        when(debitNoteMock.getStatus()).thenReturn("RECEIVED");

        const process = new AgreementPaymentProcess(instance(agreementMock), allocation, instance(mockPaymentApi), {
          debitNoteFilter: () => true,
          invoiceFilter: () => true,
        });

        when(debitNoteMock.id).thenReturn("debit-note-id");
        const debitNote = instance(debitNoteMock);

        // Simulate issue with accepting the first one
        const issue = new Error("Failed to accept in yagna");
        when(mockPaymentApi.acceptDebitNote(debitNote, allocation, "0.123"))
          .thenReject(issue) // On first call
          .thenResolve(debitNote); // On second call

        await expect(() => process.addDebitNote(debitNote)).rejects.toThrow(
          "Unable to accept debit note debit-note-id. Error: Failed to accept in yagna",
        );

        // Then simulate the duplicate coming again
        const success = await process.addDebitNote(debitNote);

        expect(success).toEqual(true);
        verify(mockPaymentApi.acceptDebitNote(debitNote, allocation, "0.123")).twice();
        expect(process.isFinished()).toEqual(false);
      });

      it("doesn't accept the same debit note twice if the previous one was already processed", async () => {
        when(debitNoteMock.getStatus()).thenReturn("ACCEPTED");

        const process = new AgreementPaymentProcess(
          instance(agreementMock),
          instance(allocationMock),
          instance(mockPaymentApi),
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
        verify(mockPaymentApi.rejectDebitNote(debitNote, anything())).never();
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
          instance(mockPaymentApi),
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
