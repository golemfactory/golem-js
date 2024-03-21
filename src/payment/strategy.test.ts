import { imock, instance, when } from "@johanblumenberg/ts-mockito";
import {
  acceptAllDebitNotesFilter,
  acceptAllInvoicesFilter,
  acceptMaxAmountDebitNoteFilter,
  acceptMaxAmountInvoiceFilter,
} from "./strategy";
import { DebitNoteDTO } from "./debit_note";
import { InvoiceDTO } from "./invoice";

describe("SDK provided Payment Filters", () => {
  describe("acceptAllDebitNotesFilter", () => {
    test("Accepts all debit notes", () => {
      const mockDebitNoteDto = imock<DebitNoteDTO>();
      const debitNotes = [instance(mockDebitNoteDto), instance(mockDebitNoteDto)];
      const accepted = debitNotes.filter(acceptAllDebitNotesFilter());
      expect(accepted.length).toEqual(2);
    });
  });

  describe("acceptAllInvoicesFilter", () => {
    test("Accepts all invoices", () => {
      const mockInvoiceDto = imock<InvoiceDTO>();
      const invoices = [instance(mockInvoiceDto), instance(mockInvoiceDto)];
      const accepted = invoices.filter(acceptAllInvoicesFilter());
      expect(accepted.length).toEqual(2);
    });
  });

  describe("acceptMaxAmountDebitNoteFilter", () => {
    test("Accepts debit notes that don't exceed a specified amount", async () => {
      const mockDebitNoteDto0 = imock<DebitNoteDTO>();
      when(mockDebitNoteDto0.totalAmountDue).thenReturn("100");
      const mockDebitNoteDto1 = imock<DebitNoteDTO>();
      when(mockDebitNoteDto1.totalAmountDue).thenReturn("200");
      const debitNotes = [instance(mockDebitNoteDto0), instance(mockDebitNoteDto1)];

      const filter = acceptMaxAmountDebitNoteFilter(150);
      const accepted: DebitNoteDTO[] = [];
      for (const debitNote of debitNotes) {
        if (await filter(debitNote)) {
          accepted.push(debitNote);
        }
      }
      expect(accepted.length).toEqual(1);
      expect(accepted[0].totalAmountDue).toEqual("100");
    });
  });

  describe("acceptMaxAmountInvoiceFilter", () => {
    test("Accepts invoices that don't exceed a specified amount", async () => {
      const mockInvoiceDto0 = imock<InvoiceDTO>();
      when(mockInvoiceDto0.amount).thenReturn("100");
      const mockInvoiceDto1 = imock<InvoiceDTO>();
      when(mockInvoiceDto1.amount).thenReturn("200");
      const invoices = [instance(mockInvoiceDto0), instance(mockInvoiceDto1)];

      const filter = acceptMaxAmountInvoiceFilter(150);
      const accepted: InvoiceDTO[] = [];
      for (const invoice of invoices) {
        if (await filter(invoice)) {
          accepted.push(invoice);
        }
      }
      expect(accepted.length).toEqual(1);
      expect(accepted[0].amount).toEqual("100");
    });
  });
});
