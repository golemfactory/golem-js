import { setExpectedProposals } from "../mock/rest/market.js";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Demand, Proposal, DemandEventType, DemandEvent } from "../../yajsapi/market/index.js";
import { allocationMock, packageMock, LoggerMock } from "../mock/index.js";
import { proposalsInitial } from "../mock/fixtures/index.js";

chai.use(chaiAsPromised);
const expect = chai.expect;
const subnetTag = "testnet";
const logger = new LoggerMock();

describe("Demand", () => {
  describe("Creating", () => {
    it("should create and publish demand", async () => {
      const demand = await Demand.create(packageMock, [allocationMock], { subnetTag, logger });
      expect(demand).to.be.instanceof(Demand);
      expect(logger.logs).to.include("Demand published on the market");
      await demand.unsubscribe();
    });
  });
  describe("Processing", () => {
    it("should get proposal after publish demand", async () => {
      const demand = await Demand.create(packageMock, [allocationMock], { subnetTag });
      setExpectedProposals(proposalsInitial);
      const event: DemandEvent = await new Promise((res) =>
        demand.addEventListener(DemandEventType, (e) => res(e as DemandEvent))
      );
      expect(event.proposal).to.be.instanceof(Proposal);
      await demand.unsubscribe();
    });
  });
});
