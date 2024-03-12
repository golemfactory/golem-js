import { Invoice } from "./invoice";
import { anything, imock, instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { YagnaApi } from "../utils";
import { PaymentApi, MarketApi } from "ya-ts-client";
import { GolemPaymentError, PaymentErrorCode } from "./error";

const mockYagna = mock(YagnaApi);
const mockPayment = mock(PaymentApi.RequestorService);
const mockMarket = mock(MarketApi.RequestorService);
const mockAgreement = imock<MarketApi.AgreementDTO>();
const mockOffer = imock<MarketApi.OfferDTO>();

describe("Invoice", () => {
  beforeEach(() => {
    reset(mockYagna);
    reset(mockPayment);
    reset(mockMarket);
    reset(mockAgreement);
    reset(mockOffer);

    when(mockYagna.payment).thenReturn(instance(mockPayment));
    when(mockYagna.market).thenReturn(instance(mockMarket));

    when(mockAgreement.offer).thenReturn(instance(mockOffer));
    when(mockOffer.properties).thenReturn({
      "golem.node.id.name": "provider-test",
    });

    when(mockMarket.getAgreement("agreement-id")).thenResolve(instance(mockAgreement));

    when(mockPayment.getInvoice("invoiceId")).thenResolve({
      invoiceId: "invoiceId",
      issuerId: "issuer-id",
      payeeAddr: "0xPAYEE",
      payerAddr: "0xPAYER",
      recipientId: "recipient-id",
      paymentPlatform: "goerli",
      timestamp: "2023-01-01T00:00:00.000Z",
      agreementId: "agreement-id",
      status: "RECEIVED",
      amount: "10.00",
      paymentDueDate: "2023-01-02T00:00:00.000Z",
      activityIds: ["activity-1"],
    });
  });

  describe("accepting", () => {
    test("throw GolemPaymentError if invoice cannot be accepted", async () => {
      const errorYagnaApiMock = new Error("test error");
      when(mockPayment.acceptInvoice("invoiceId", anything())).thenReject(errorYagnaApiMock);

      const invoice = await Invoice.create("invoiceId", instance(mockYagna));

      await expect(invoice.accept(1, "testAllocationId")).rejects.toMatchError(
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
      when(mockPayment.getInvoice("invoice-a")).thenResolve({
        invoiceId: "invoice-a",
        issuerId: "issuer-id",
        payeeAddr: "0xPAYEE",
        payerAddr: "0xPAYER",
        recipientId: "recipient-id",
        paymentPlatform: "goerli",
        timestamp: "2023-01-01T00:00:00.000Z",
        agreementId: "agreement-id",
        status: "RECEIVED",
        amount: "10.00",
        paymentDueDate: "2023-01-02T00:00:00.000Z",
        activityIds: ["activity-1"],
      });

      const invoiceA = await Invoice.create("invoice-a", instance(mockYagna));
      const invoiceB = await Invoice.create("invoice-a", instance(mockYagna));

      expect(invoiceA.isSameAs(invoiceB)).toEqual(true);
    });

    test("returns false if the invoices don't share required properties", async () => {
      when(mockPayment.getInvoice("invoice-a")).thenResolve({
        invoiceId: "invoice-a",
        issuerId: "issuer-id",
        payeeAddr: "0xPAYEE",
        payerAddr: "0xPAYER",
        recipientId: "recipient-id",
        paymentPlatform: "goerli",
        timestamp: "2023-01-01T00:00:00.000Z",
        agreementId: "agreement-id",
        status: "RECEIVED",
        amount: "10.00",
        paymentDueDate: "2023-01-02T00:00:00.000Z",
        activityIds: ["activity-1"],
      });

      when(mockPayment.getInvoice("invoice-b")).thenResolve({
        invoiceId: "invoice-b",
        issuerId: "issuer-id",
        payeeAddr: "0xPAYEE",
        payerAddr: "0xPAYER",
        recipientId: "recipient-id",
        paymentPlatform: "goerli",
        timestamp: "2023-01-01T00:00:00.000Z",
        agreementId: "agreement-id",
        status: "RECEIVED",
        amount: "1000000000000000000000000000000.00",
        paymentDueDate: "2023-01-02T00:00:00.000Z",
        activityIds: ["activity-cheated"],
      });

      const invoiceA = await Invoice.create("invoice-a", instance(mockYagna));
      const invoiceB = await Invoice.create("invoice-b", instance(mockYagna));

      expect(invoiceA.isSameAs(invoiceB)).toEqual(false);
    });
  });
});
