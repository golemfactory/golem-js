import { Invoice } from "./invoice";
import { imock, instance, mock, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { RequestorApi as PaymentRequestorApi } from "ya-ts-client/dist/ya-payment/src/api/requestor-api";
import { InvoiceStatus } from "ya-ts-client/dist/ya-payment/src/models";

const mockYagnaApi = imock<YagnaApi>();
const mockPaymentApi = mock(PaymentRequestorApi);

describe("Invoice", () => {
  describe("isSameAs", () => {
    test("returns true if the invoices share required properties", async () => {
      when(mockYagnaApi.payment).thenReturn(instance(mockPaymentApi));

      when(mockPaymentApi.getInvoice("invoice-a")).thenResolve({
        config: {},
        headers: {},
        status: 200,
        statusText: "OK",
        data: {
          invoiceId: "invoice-a",
          issuerId: "issuer-id",
          payeeAddr: "0xPAYEE",
          payerAddr: "0xPAYER",
          recipientId: "recipient-id",
          paymentPlatform: "goerli",
          timestamp: "2023-01-01T00:00:00.000Z",
          agreementId: "agreement-id",
          status: InvoiceStatus.Received,
          amount: "10.00",
          paymentDueDate: "2023-01-02T00:00:00.000Z",
          activityIds: ["activity-1"],
        },
      });

      const invoiceA = await Invoice.create("invoice-a", instance(mockYagnaApi));
      const invoiceB = await Invoice.create("invoice-a", instance(mockYagnaApi));

      expect(invoiceA.isSameAs(invoiceB)).toEqual(true);
    });

    test("returns false if the invoices don't share required properties", async () => {
      when(mockYagnaApi.payment).thenReturn(instance(mockPaymentApi));

      when(mockPaymentApi.getInvoice("invoice-a")).thenResolve({
        config: {},
        headers: {},
        status: 200,
        statusText: "OK",
        data: {
          invoiceId: "invoice-a",
          issuerId: "issuer-id",
          payeeAddr: "0xPAYEE",
          payerAddr: "0xPAYER",
          recipientId: "recipient-id",
          paymentPlatform: "goerli",
          timestamp: "2023-01-01T00:00:00.000Z",
          agreementId: "agreement-id",
          status: InvoiceStatus.Received,
          amount: "10.00",
          paymentDueDate: "2023-01-02T00:00:00.000Z",
          activityIds: ["activity-1"],
        },
      });

      when(mockPaymentApi.getInvoice("invoice-b")).thenResolve({
        config: {},
        headers: {},
        status: 200,
        statusText: "OK",
        data: {
          invoiceId: "invoice-b",
          issuerId: "issuer-id",
          payeeAddr: "0xPAYEE",
          payerAddr: "0xPAYER",
          recipientId: "recipient-id",
          paymentPlatform: "goerli",
          timestamp: "2023-01-01T00:00:00.000Z",
          agreementId: "agreement-id",
          status: InvoiceStatus.Received,
          amount: "1000000000000000000000000000000.00",
          paymentDueDate: "2023-01-02T00:00:00.000Z",
          activityIds: ["activity-cheated"],
        },
      });

      const invoiceA = await Invoice.create("invoice-a", instance(mockYagnaApi));
      const invoiceB = await Invoice.create("invoice-b", instance(mockYagnaApi));

      expect(invoiceA.isSameAs(invoiceB)).toEqual(false);
    });
  });
});
