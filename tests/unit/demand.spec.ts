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
    expect(demand).to.be.true;
    const offer = await new Promise((res) => demand.on("offer", res));
    expect(offer).to.be.true;
  });

  // TODO
  it("add property to demand");

  // TODO
  it("publish demand on the market");
});
