import { setExpectedProposals } from "../mock/rest/market";
import { Demand, Proposal, DEMAND_EVENT_TYPE, DemandEvent } from "../../src/market";
import { allocationMock, packageMock, LoggerMock, YagnaMock } from "../mock";
import { proposalsInitial } from "../mock/fixtures";

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
});
