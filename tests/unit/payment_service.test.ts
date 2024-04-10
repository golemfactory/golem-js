import { Allocation, GolemPaymentError, PaymentErrorCode, PaymentFilters, PaymentService } from "../../src/payment";
import { debitNotes, debitNotesEvents, invoiceEvents, invoices } from "../fixtures";
import { anything, instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { LoggerMock } from "../mock/utils/logger";
import { Agreement, GolemUserError, YagnaApi } from "../../src";
import * as YaTsClient from "ya-ts-client";

import { simulateLongPoll } from "./helpers";

const logger = new LoggerMock();

const mockYagna = mock(YagnaApi);

const mockIdentity = mock(YaTsClient.IdentityApi.DefaultService);
const mockPayment = mock(YaTsClient.PaymentApi.RequestorService);
const mockMarket = mock(YaTsClient.MarketApi.RequestorService);
const mockAgreement = mock(Agreement);

const yagnaApi = instance(mockYagna);
const agreement = instance(mockAgreement);

/**
 * service.end() waits for invoices to be paid, in unit-tests that should be below 5s
 */
const TEST_PAYMENT_TIMEOUT_MS = 1000;

describe("Payment Service", () => {
  beforeEach(() => {
    logger.clear();

    reset(mockYagna);
    reset(mockIdentity);
    reset(mockPayment);
    reset(mockMarket);
    reset(mockAgreement);

    when(mockIdentity.getIdentity()).thenResolve({ identity: "identity-id", name: "test-identity", role: "tester" });
    when(mockYagna.identity).thenReturn(instance(mockIdentity));

    when(mockPayment.createAllocation(anything())).thenResolve({
      makeDeposit: false,
      remainingAmount: "10",
      spentAmount: "0",
      timestamp: new Date().toISOString(),
      totalAmount: "10",
      allocationId: "allocation-id",
      paymentPlatform: "erc20-holesky-tglm",
      address: "0xtest",
    });
    when(mockYagna.payment).thenReturn(instance(mockPayment));

    const TEST_AGREEMENT_ID = invoices[0].agreementId;

    when(mockAgreement.id).thenReturn(TEST_AGREEMENT_ID);
    when(mockAgreement.getProviderInfo()).thenReturn({
      id: "provider-id",
      name: "provider-name",
      walletAddress: "provider-wallet",
    });

    when(mockMarket.getAgreement(TEST_AGREEMENT_ID)).thenResolve({
      agreementId: TEST_AGREEMENT_ID,
      demand: {
        requestorId: "requestor-id",
        demandId: "demand-id",
        properties: {},
        constraints: "",
        timestamp: new Date().toISOString(),
      },
      offer: {
        offerId: "offer-id",
        providerId: "provider-id",
        properties: {},
        constraints: "",
        timestamp: new Date().toISOString(),
      },
      state: "Approved",
      timestamp: new Date().toISOString(),
      validTo: "",
    });

    when(mockYagna.market).thenReturn(instance(mockMarket));
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

    it("should throw GolemPaymentError if allocation cannot be created", async () => {
      const yagna = mock(YagnaApi);
      const brokenPayment = mock(YaTsClient.PaymentApi.RequestorService);

      when(yagna.payment).thenReturn(instance(brokenPayment));
      when(yagna.identity).thenReturn(instance(mockIdentity));

      const errorYagnaApiMock = new Error("test error");
      when(brokenPayment.createAllocation(anything())).thenReject(errorYagnaApiMock);

      const paymentService = new PaymentService(instance(yagna), { logger });

      await expect(paymentService.createAllocation()).rejects.toMatchError(
        new GolemPaymentError(
          `Could not create new allocation. ${errorYagnaApiMock}`,
          PaymentErrorCode.AllocationCreationFailed,
          undefined,
          undefined,
          errorYagnaApiMock,
        ),
      );
    });
  });

  describe("acceptPayments", () => {
    it("should throw GolemPaymentError if allocation is not created", async () => {
      const paymentService = new PaymentService(yagnaApi, {
        logger,
        invoiceFilter: PaymentFilters.acceptMaxAmountInvoiceFilter(7),
      });

      when(mockPayment.getInvoiceEvents(anything(), anything(), anything(), anything())).thenCall(() =>
        simulateLongPoll(invoiceEvents),
      );
      when(mockPayment.getInvoice(anything())).thenResolve(invoices[0]);

      await paymentService.run();
      expect(() => paymentService.acceptPayments(agreement)).toThrow(
        new GolemPaymentError(
          "You need to create an allocation before starting any payment processes",
          PaymentErrorCode.MissingAllocation,
          undefined,
          agreement.getProviderInfo(),
        ),
      );
      await paymentService.end();
    });
  });

  describe("Events API", () => {
    describe("emitting 'error' event", () => {
      it("should emit when there's an issue with processing the debit note", async () => {
        // Given
        const error = new Error("Broken debit note filter");

        const paymentService = new PaymentService(yagnaApi, {
          logger,
          debitNotesFilter: () => {
            throw error;
          },
          paymentTimeout: TEST_PAYMENT_TIMEOUT_MS,
        });

        when(mockPayment.getInvoiceEvents(anything(), anything(), anything(), anything())).thenCall(() =>
          simulateLongPoll([]),
        );
        when(mockPayment.getDebitNoteEvents(anything(), anything(), anything(), anything())).thenCall(() =>
          simulateLongPoll(debitNotesEvents),
        );
        when(mockPayment.getDebitNote(anything())).thenResolve(debitNotes[0]);

        const handler = jest.fn();
        paymentService.events.once("error", handler);

        // When
        await paymentService.createAllocation();
        paymentService.acceptPayments(agreement);
        await paymentService.run();
        await paymentService.end();

        // Then
        expect(handler).toHaveBeenCalledWith(new GolemUserError("An error occurred in the debit note filter", error));
      });

      it("should emit an error event when there's an issue with processing the invoice", async () => {
        // Given
        const error = new Error("Broken invoice filter");

        const paymentService = new PaymentService(yagnaApi, {
          logger,
          invoiceFilter: () => {
            throw error;
          },
          paymentTimeout: TEST_PAYMENT_TIMEOUT_MS,
        });

        when(mockPayment.getDebitNoteEvents(anything(), anything(), anything(), anything())).thenCall(() =>
          simulateLongPoll([]),
        );
        when(mockPayment.getInvoiceEvents(anything(), anything(), anything(), anything())).thenCall(() =>
          simulateLongPoll(invoiceEvents),
        );
        when(mockPayment.getInvoice(anything())).thenResolve(invoices[0]);

        const handler = jest.fn();
        paymentService.events.once("error", handler);

        // When
        await paymentService.createAllocation();
        paymentService.acceptPayments(agreement);
        await paymentService.run();
        await paymentService.end();

        // Then
        expect(handler).toHaveBeenCalledWith(new GolemUserError("An error occurred in the invoice filter", error));
      });
    });
  });
});
