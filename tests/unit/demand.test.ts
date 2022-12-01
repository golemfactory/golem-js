import rewiremock from "rewiremock";
import { MarketApiMock, setExpectedProposals } from "../mock/market_api";
rewiremock("ya-ts-client/dist/ya-market/api").with({ RequestorApi: MarketApiMock });
rewiremock.enable();
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { Demand, Proposal, DemandEvent } from "../../yajsapi/market";
import { allocationMock, packageMock, LoggerMock } from "../mock";
import { proposalsInitial, proposalsDraft } from "../mock/fixtures/proposals";

const subnetTag = "testnet";
const logger = new LoggerMock();

describe("Demand", () => {
  describe("Creating", () => {
    it("should create and publish demand", async () => {
      const demand = await Demand.create(packageMock, [allocationMock], { subnetTag, logger });
      expect(demand).to.be.instanceof(Demand);
      expect(logger.logs).to.be.match(/Demand .* created and published on the market/);
      await demand.unsubscribe();
    });
  });
  describe("Processing", () => {
    it("should get proposal after publish demand", async () => {
      const demand = await Demand.create(packageMock, [allocationMock], { subnetTag });
      setExpectedProposals(proposalsInitial);
      const proposal = await new Promise((res) => demand.on(DemandEvent.ProposalReceived, res));
      expect(proposal).to.be.instanceof(Proposal);
      await demand.unsubscribe();
    });

    it("should get offer after publish demand and respond proposal", async () => {
      const demand = await Demand.create(packageMock, [allocationMock], { subnetTag });
      setExpectedProposals(proposalsInitial);
      demand.on("proposal", (proposal) => proposal.respond());
      setExpectedProposals(proposalsDraft);
      const proposal: Proposal = await new Promise((res) => demand.on(DemandEvent.ProposalReceived, res));
      expect(proposal).to.be.instanceof(Proposal);
      expect(proposal.isDraft()).to.be.true;
      await demand.unsubscribe();
    });
  });
});
