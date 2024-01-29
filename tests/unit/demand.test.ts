import { setExpectedProposals } from "../mock/rest/market";
import { Demand, DEMAND_EVENT_TYPE, DemandEvent, GolemMarketError, MarketErrorCode, Proposal } from "../../src/market";
import { allocationMock, LoggerMock, packageMock, YagnaMock } from "../mock";
import { proposalsInitial } from "../mock/fixtures";
import { anything, spy, when } from "@johanblumenberg/ts-mockito";
import { GolemConfigError, GolemUserError } from "../../src/error/golem-error";

const subnetTag = "testnet";
const logger = new LoggerMock();
const yagnaApi = new YagnaMock().getApi();

describe("Demand", () => {
  describe("Creating", () => {
    it("should create and publish demand", async () => {
      const demand = await Demand.create(packageMock, allocationMock, yagnaApi, { subnetTag, logger });
      expect(demand).toBeInstanceOf(Demand);
      expect(logger.logs).toContain("Demand published on the market");
      await demand.unsubscribe();
    });
  });
  describe("Processing", () => {
    it("should get proposal after publish demand", async () => {
      const demand = await Demand.create(packageMock, allocationMock, yagnaApi, { subnetTag });
      setExpectedProposals(proposalsInitial);
      const event: DemandEvent = await new Promise((res) =>
        demand.addEventListener(DEMAND_EVENT_TYPE, (e) => res(e as DemandEvent)),
      );
      expect(event.proposal).toBeInstanceOf(Proposal);
      await demand.unsubscribe();
    });
  });
  describe("Error handling", () => {
    it("should throw market error if demand cannot be created", async () => {
      const spySubscribe = spy(yagnaApi.market);
      const testError = new Error("Test error");
      when(spySubscribe.subscribeDemand(anything())).thenThrow(testError);
      await expect(Demand.create(packageMock, allocationMock, yagnaApi)).rejects.toMatchError(
        new GolemMarketError(
          `Could not publish demand on the market. Error: Test error`,
          MarketErrorCode.SubscriptionFailed,
          undefined,
          testError,
        ),
      );
    });
    it("should throw user error if expiration option is invalid", async () => {
      await expect(Demand.create(packageMock, allocationMock, yagnaApi, { expirationSec: -3 })).rejects.toMatchError(
        new GolemConfigError("The demand expiration time has to be a positive integer"),
      );
    });
    it("should throw user error if debitNotesAcceptanceTimeoutSec option is invalid", async () => {
      await expect(
        Demand.create(packageMock, allocationMock, yagnaApi, { debitNotesAcceptanceTimeoutSec: -3 }),
      ).rejects.toMatchError(
        new GolemConfigError("The debit note acceptance timeout time has to be a positive integer"),
      );
    });
    it("should throw user error if midAgreementDebitNoteIntervalSec option is invalid", async () => {
      await expect(
        Demand.create(packageMock, allocationMock, yagnaApi, { midAgreementDebitNoteIntervalSec: -3 }),
      ).rejects.toMatchError(new GolemConfigError("The debit note interval time has to be a positive integer"));
    });
    it("should throw user error if midAgreementPaymentTimeoutSec option is invalid", async () => {
      await expect(
        Demand.create(packageMock, allocationMock, yagnaApi, { midAgreementPaymentTimeoutSec: -3 }),
      ).rejects.toMatchError(
        new GolemConfigError("The mid-agreement payment timeout time has to be a positive integer"),
      );
    });
  });
});
