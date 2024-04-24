import { Invoice } from "./invoice";
import { PaymentApi } from "ya-ts-client";
import Decimal from "decimal.js-light";

const TEST_PROVIDER_INFO = { id: "provider-id", name: "provider-name", walletAddress: "0xTestWallet" };

// Skipped as the tests will be migrated to respective service unit test after refactoring
describe("Invoice", () => {
  describe("creating", () => {
    test("create invoice with a big number amount", async () => {
      const invoice = new Invoice(
        {
          invoiceId: "invoiceId",
          issuerId: "issuer-id",
          payeeAddr: "0xPAYEE",
          payerAddr: "0xPAYER",
          recipientId: "recipient-id",
          paymentPlatform: "holesky",
          timestamp: "2023-01-01T00:00:00.000Z",
          agreementId: "agreement-id",
          status: "RECEIVED",
          amount: "0.009551938349900001",
          paymentDueDate: "2023-01-02T00:00:00.000Z",
          activityIds: ["activity-1"],
        },
        TEST_PROVIDER_INFO,
      );
      expect(new Decimal("0.009551938349900001").eq(new Decimal(invoice.amount))).toEqual(true);
    });
  });

  describe("isSameAs", () => {
    test("returns true if the invoices share required properties", async () => {
      const dto: PaymentApi.InvoiceDTO = {
        invoiceId: "invoice-a",
        issuerId: "issuer-id",
        payeeAddr: "0xPAYEE",
        payerAddr: "0xPAYER",
        recipientId: "recipient-id",
        paymentPlatform: "holesky",
        timestamp: "2023-01-01T00:00:00.000Z",
        agreementId: "agreement-id",
        status: "RECEIVED",
        amount: "10.00",
        paymentDueDate: "2023-01-02T00:00:00.000Z",
        activityIds: ["activity-1"],
      };

      const invoiceA = new Invoice(dto, TEST_PROVIDER_INFO);
      const invoiceB = new Invoice(dto, TEST_PROVIDER_INFO);

      expect(invoiceA.isSameAs(invoiceB)).toEqual(true);
    });

    test("returns false if the invoices don't share required properties", async () => {
      const invoiceA = new Invoice(
        {
          invoiceId: "invoice-a",
          issuerId: "issuer-id",
          payeeAddr: "0xPAYEE",
          payerAddr: "0xPAYER",
          recipientId: "recipient-id",
          paymentPlatform: "holesky",
          timestamp: "2023-01-01T00:00:00.000Z",
          agreementId: "agreement-id",
          status: "RECEIVED",
          amount: "10.00",
          paymentDueDate: "2023-01-02T00:00:00.000Z",
          activityIds: ["activity-1"],
        },
        TEST_PROVIDER_INFO,
      );

      const invoiceB = new Invoice(
        {
          invoiceId: "invoice-b",
          issuerId: "issuer-id",
          payeeAddr: "0xPAYEE",
          payerAddr: "0xPAYER",
          recipientId: "recipient-id",
          paymentPlatform: "holesky",
          timestamp: "2023-01-01T00:00:00.000Z",
          agreementId: "agreement-id",
          status: "RECEIVED",
          amount: "1000000000000000000000000000000.00",
          paymentDueDate: "2023-01-02T00:00:00.000Z",
          activityIds: ["activity-cheated"],
        },
        TEST_PROVIDER_INFO,
      );

      expect(invoiceA.isSameAs(invoiceB)).toEqual(false);
    });
  });
});
