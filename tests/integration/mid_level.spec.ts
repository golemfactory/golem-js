import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import {
  Demand,
  Allocation,
  Package,
  DemandEvent,
  DemandEventType,
  Agreement,
  Activity,
  Script,
  Run,
  Start,
  Deploy,
  Result,
} from "../../yajsapi/index_mid";
import { resolve } from "path";
import { Proposal } from "../../yajsapi/market";
import { Goth } from "./goth";
import { Accounts } from "../../yajsapi/payment/accounts";
chai.use(chaiAsPromised);
const expect = chai.expect;
const gothConfig = resolve("../goth/assets/goth-config.yml");
const goth = new Goth(gothConfig);

describe("Mid-level modules", () => {
  let apiKey, basePath, subnetTag;
  before(async () => {
    ({ apiKey, basePath, subnetTag } = await goth.start());
  });
  after(async () => {
    await goth.end();
  });

  it("should run simple script on provider", async () => {
    const accounts = await (await Accounts.create()).list();
    const account = accounts[0];
    const taskPackage = await Package.create({ imageHash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae" });
    const allocation = await Allocation.create({ account });
    const demand = await Demand.create(taskPackage, [allocation], { subnetTag });
    const offer: Proposal = await new Promise((res) =>
      demand.addEventListener(DemandEventType, async (event) => {
        const proposalEvent = event as DemandEvent;
        if (proposalEvent.proposal.isInitial()) await proposalEvent.proposal.respond(account.platform);
        else if (proposalEvent.proposal.isDraft()) res(proposalEvent.proposal);
      })
    );
    const agreement = await Agreement.create(offer.id);
    await agreement.confirm();
    const activity = await Activity.create(agreement.id);
    const script = await Script.create([new Deploy(), new Start(), new Run("/bin/sh", ["-c", "echo 'Hello Golem'"])]);
    const exeScript = script.getExeScriptRequest();
    const streamResult = await activity.execute(exeScript);
    const results: Result[] = [];
    for await (const result of streamResult) results.push(result);
    expect(results[2]).to.include({ stdout: "Hello Golem\n" });
    await activity.stop();
    await agreement.terminate();
    await allocation.release();
    await demand.unsubscribe();
  }).timeout(30000);
});
