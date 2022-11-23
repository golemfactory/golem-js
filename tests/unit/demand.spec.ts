import rewiremock from "rewiremock";
import { MarketApiMock } from "../mock/market_api";
rewiremock("ya-ts-client/dist/ya-market/api").with({ RequestorApi: MarketApiMock });
rewiremock.enable();
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const expect = chai.expect;
import { Demand } from "../../yajsapi/core";
import { allocationMock, packageMock } from "../mock";

const subnetTag = "testnet";

describe("Demand", () => {
  it("should create demand", async () => {
    const demand = await Demand.create(packageMock, [allocationMock], { subnetTag });
    expect(demand).to.be.instanceof(Demand);
    // const offer = await new Promis
  });

  // TODO
  it("add property to demand");

  // TODO
  it("publish demand on the market");
});
