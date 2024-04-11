import {
  Allocation,
  Demand,
  GolemConfigError,
  GolemMarketError,
  MarketErrorCode,
  Package,
  Proposal,
  YagnaApi,
} from "../../src";
import { proposalsInitial } from "../fixtures";
import { anything, instance, mock, reset, when } from "@johanblumenberg/ts-mockito";
import { LoggerMock } from "../mock/utils/logger";
import * as YaTsClient from "ya-ts-client";

const subnetTag = "testnet";
const logger = new LoggerMock();

const mockYagna = mock(YagnaApi);
const mockMarket = mock(YaTsClient.MarketApi.RequestorService);
const mockPayment = mock(YaTsClient.PaymentApi.RequestorService);
const mockPackage = mock(Package);
const mockAllocation = mock(Allocation);

const yagnaApi = instance(mockYagna);

describe("Demand", () => {
  beforeEach(() => {
    reset(mockYagna);
    reset(mockMarket);
    reset(mockPayment);
    reset(mockPackage);
    reset(mockAllocation);

    when(mockYagna.market).thenReturn(instance(mockMarket));
    when(mockYagna.payment).thenReturn(instance(mockPayment));

    when(mockPackage.getDemandDecoration()).thenResolve({
      properties: [{ key: "", value: "" }],
      constraints: [],
    });

    when(mockAllocation.getDemandDecoration()).thenResolve({
      properties: [{ key: "", value: "" }],
      constraints: [],
    });

    when(mockAllocation.paymentPlatform).thenReturn("erc20-holesky-tglm");

    when(mockPayment.getDemandDecorations(anything())).thenResolve({
      properties: [{ key: "", value: "" }],
      constraints: [],
    });

    when(mockMarket.subscribeDemand(anything())).thenResolve("demand-id");
  });

  describe("Creating", () => {
    it("should create and publish demand", async () => {
      const demand = await Demand.create(instance(mockPackage), instance(mockAllocation), yagnaApi, {
        subnetTag,
        logger,
      });
      expect(demand).toBeInstanceOf(Demand);
      expect(logger.logs).toContain("Demand published on the market");
      await demand.unsubscribe();
    });
  });

  describe("Processing", () => {
    it("should get proposal after publish demand", async () => {
      const demand = await Demand.create(instance(mockPackage), instance(mockAllocation), yagnaApi, { subnetTag });

      when(mockMarket.collectOffers(anything(), anything(), anything())).thenResolve(proposalsInitial);

      const proposal = await new Promise((res) => demand.events.on("proposalReceived", (proposal) => res(proposal)));
      expect(proposal).toBeInstanceOf(Proposal);
      await demand.unsubscribe();
    });
  });

  describe("Error handling", () => {
    it("should throw market error if demand cannot be created", async () => {
      const testError = new Error("Test error");

      when(mockMarket.subscribeDemand(anything())).thenThrow(testError);

      await expect(Demand.create(instance(mockPackage), instance(mockAllocation), yagnaApi)).rejects.toMatchError(
        new GolemMarketError(
          `Could not publish demand on the market. Error: Test error`,
          MarketErrorCode.SubscriptionFailed,
          undefined,
          testError,
        ),
      );
    });

    it("should throw user error if expiration option is invalid", async () => {
      await expect(
        Demand.create(instance(mockPackage), instance(mockAllocation), yagnaApi, { expirationSec: -3 }),
      ).rejects.toMatchError(new GolemConfigError("The demand expiration time has to be a positive integer"));
    });

    it("should throw user error if debitNotesAcceptanceTimeoutSec option is invalid", async () => {
      await expect(
        Demand.create(instance(mockPackage), instance(mockAllocation), yagnaApi, {
          debitNotesAcceptanceTimeoutSec: -3,
        }),
      ).rejects.toMatchError(
        new GolemConfigError("The debit note acceptance timeout time has to be a positive integer"),
      );
    });

    it("should throw user error if midAgreementDebitNoteIntervalSec option is invalid", async () => {
      await expect(
        Demand.create(instance(mockPackage), instance(mockAllocation), yagnaApi, {
          midAgreementDebitNoteIntervalSec: -3,
        }),
      ).rejects.toMatchError(new GolemConfigError("The debit note interval time has to be a positive integer"));
    });

    it("should throw user error if midAgreementPaymentTimeoutSec option is invalid", async () => {
      await expect(
        Demand.create(instance(mockPackage), instance(mockAllocation), yagnaApi, { midAgreementPaymentTimeoutSec: -3 }),
      ).rejects.toMatchError(
        new GolemConfigError("The mid-agreement payment timeout time has to be a positive integer"),
      );
    });
  });
});
