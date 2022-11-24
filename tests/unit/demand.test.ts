import rewiremock from "rewiremock";
import { MarketApiMock } from "../mock/market_api";
rewiremock("ya-ts-client/dist/ya-market/api").with({ RequestorApi: MarketApiMock });
rewiremock.enable();
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { logger } from "../mock/logger";
import { Demand, Proposal, Offer } from "../../yajsapi/core";
import { allocationMock, packageMock } from "../mock";
import { offersInitial, offersDraft } from "../mock/fixtures/offers";

const subnetTag = "testnet";

describe("Demand", () => {
  it("should create and publish demand", async () => {
    const demand = await Demand.create(packageMock, [allocationMock], { subnetTag });
    expect(demand).to.be.instanceof(Demand);
    await demand.unsubscribe();
  });

  it("should get proposal after publish demand", async () => {
    const demand = await Demand.create(packageMock, [allocationMock], { subnetTag });
    demand["api"]["setExpectedOffers"](offersInitial);
    const proposal = await new Promise((res) => demand.on("proposal", res));
    expect(proposal).to.be.instanceof(Proposal);
    await demand.unsubscribe();
  });

  it("should get offer after publish demand and respond proposal", async () => {
    const demand = await Demand.create(packageMock, [allocationMock], { subnetTag });
    demand["api"]["setExpectedOffers"](offersInitial);
    demand.on("proposal", (proposal) => proposal.respond());
    demand["api"]["setExpectedOffers"](offersDraft);
    const offer = await new Promise((res) => demand.on("offer", res));
    expect(offer).to.be.instanceof(Offer);
    await demand.unsubscribe();
  });

  it("should reject proposal which has no common payment platforms", async () => {
    const demand = await Demand.create(packageMock, [allocationMock], { subnetTag, logger });
    demand["api"]["setExpectedOffers"]([offersInitial[6]]);
    await new Promise((res) => setTimeout(res, 100));
    expect(logger.outputs).to.include(
      `Proposal ${offersInitial[6].proposal.proposalId} rejected. Reason: No common payments platform`
    );
    await demand.unsubscribe();
  });
});
