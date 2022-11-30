import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Demand, Allocation, Demand } from "../../yajsapi/core";
import { logger } from "../mock/logger";
chai.use(chaiAsPromised);
const expect = chai.expect;

const subnetTag = "devnet-beta";

describe("Core (mid-level) modules", () => {
  let gothProcess;
  before(async () => {
    // TODO: run goth process
  });
  after(async () => {
    // TODO: stop goth process
  });
  beforeEach(() => {
    logger.clear();
  });

  it("should run simple script on provider", async () => {
    const taskPackage = await Package.create("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
    const allocation = await Allocation.create();
    const demand = await Demand.create(taskPackage, [allocation], { subnetTag });
    demand.on("proposal", (proposal) => proposal.respond());
    const offer = await new Promise((res) => demand.on("offer", res));
    const agreement = await Agreement.create(offer);
    await agreement.confirm();
    const activity = await Activity.create(agreement);
    const script = await Script.create("echo 'Hello World'");
    const exeScript = script.getExeScriptRequest();
    const results = await activity.execute(exeScript);
    expect(results).to.include({ stdout: "Hello World" });
  });
});
