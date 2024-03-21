import { Invoice } from "./invoice";
import { anything, imock, instance, mock, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { RequestorApi as PaymentRequestorApi } from "ya-ts-client/dist/ya-payment/src/api/requestor-api";
import { RequestorApi as MarketRequestorApi } from "ya-ts-client/dist/ya-market/src/api/requestor-api";
import { InvoiceStatus } from "ya-ts-client/dist/ya-payment/src/models";
import { Agreement } from "ya-ts-client/dist/ya-market/src/models";
import { GolemPaymentError, PaymentErrorCode } from "./error";
import { Decimal } from "decimal.js-light";

const mockYagnaApi = imock<YagnaApi>();
const mockPaymentApi = mock(PaymentRequestorApi);
const mockMarketApi = mock(MarketRequestorApi);

describe("Invoice", () => {
  when(mockYagnaApi.market).thenReturn(instance(mockMarketApi));
  when(mockMarketApi.getAgreement("agreement-id")).thenResolve({
    config: {},
    headers: {},
    status: 200,
    statusText: "OK",
    data: {
      agreementId: "agreement-id",
      offer: {
        properties: {
          "golem.node.id.name": "provider-test",
        },
      },
    } as Agreement,
  });
  describe("creating", () => {
    test("create invoice with a big number amount", async () => {
      when(mockPaymentApi.getInvoice("invoiceId")).thenResolve({
        config: {},
        headers: {},
        status: 200,
        statusText: "OK",
        data: {
          invoiceId: "invoiceId",
          issuerId: "issuer-id",
          payeeAddr: "0xPAYEE",
          payerAddr: "0xPAYER",
          recipientId: "recipient-id",
          paymentPlatform: "holesky",
          timestamp: "2023-01-01T00:00:00.000Z",
          agreementId: "agreement-id",
          status: InvoiceStatus.Received,
          amount: "0.009551938349900001",
          paymentDueDate: "2023-01-02T00:00:00.000Z",
          activityIds: ["activity-1"],
        },
      });
      when(mockYagnaApi.payment).thenReturn(instance(mockPaymentApi));
      const invoice = await Invoice.create("invoiceId", instance(mockYagnaApi));
      expect(new Decimal("0.009551938349900001").eq(new Decimal(invoice.amountPrecise))).toEqual(true);
    });
  });
  describe("accepting", () => {
    test("throw GolemPaymentError if invoice cannot be accepted", async () => {
      when(mockPaymentApi.getInvoice("invoiceId")).thenResolve({
        config: {},
        headers: {},
        status: 200,
        statusText: "OK",
        data: {
          invoiceId: "invoiceId",
          issuerId: "issuer-id",
          payeeAddr: "0xPAYEE",
          payerAddr: "0xPAYER",
          recipientId: "recipient-id",
          paymentPlatform: "holesky",
          timestamp: "2023-01-01T00:00:00.000Z",
          agreementId: "agreement-id",
          status: InvoiceStatus.Received,
          amount: "10.00",
          paymentDueDate: "2023-01-02T00:00:00.000Z",
          activityIds: ["activity-1"],
        },
      });
      const errorYagnaApiMock = new Error("test error");
      when(mockPaymentApi.acceptInvoice("invoiceId", anything())).thenReject(errorYagnaApiMock);
      when(mockYagnaApi.payment).thenReturn(instance(mockPaymentApi));
      const invoice = await Invoice.create("invoiceId", instance(mockYagnaApi));
      await expect(invoice.accept("1", "testAllocationId")).rejects.toMatchError(
        new GolemPaymentError(
          `Unable to accept invoice invoiceId ${errorYagnaApiMock}`,
          PaymentErrorCode.InvoiceAcceptanceFailed,
          undefined,
          {
            id: "issuer-id",
            name: "provider-test",
            walletAddress: "0xPAYEE",
          },
          errorYagnaApiMock,
        ),
      );
    });
  });
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
          paymentPlatform: "holesky",
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
      when(mockYagnaApi.market).thenReturn(instance(mockMarketApi));

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
          paymentPlatform: "holesky",
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
          paymentPlatform: "holesky",
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
