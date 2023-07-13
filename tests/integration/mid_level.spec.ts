import { expect } from "chai";
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
  Accounts,
  Proposal,
} from "../../yajsapi/index.js";
import { LoggerMock } from "../mock/index.js";
const logger = new LoggerMock(false);

describe("Mid-level modules", () => {
  before(async function () {
    logger.clear();
  });

  it("should run simple script on provider", async () => {
    const accounts = await (await Accounts.create()).list();
    const account = accounts.find((account) => account?.platform.indexOf("erc20-rinkeby") !== -1);
    if (!account) throw new Error("There is no requestor account supporting rinkeby platform");
    const taskPackage = await Package.create({ imageHash: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae" });
    const allocation = await Allocation.create({ account, logger, payment: { network: "rinkeby" } });
    const demand = await Demand.create(taskPackage, [allocation], { logger });
    const offer: Proposal = await new Promise((res) =>
      demand.addEventListener(DemandEventType, async (event) => {
        const proposalEvent = event as DemandEvent;
        if (proposalEvent.proposal.isInitial())
          await proposalEvent.proposal.respond(account.platform).catch((e) => null);
        else if (proposalEvent.proposal.isDraft()) res(proposalEvent.proposal);
      })
    );
    const agreement = await Agreement.create(offer.id, { logger });
    await agreement.confirm();
    const activity = await Activity.create(agreement.id, { logger });
    const script = await Script.create([new Deploy(), new Start(), new Run("/bin/sh", ["-c", "echo 'Hello Golem'"])]);
    await script.before();
    const exeScript = script.getExeScriptRequest();
    const streamResult = await activity.execute(exeScript);
    const results: Result[] = [];
    for await (const result of streamResult) results.push(result);
    expect(results[2]).to.include({ stdout: "Hello Golem\n" });
    await script.after(results);
    await activity.stop();
    await agreement.terminate();
    await allocation.release();
    await demand.unsubscribe();
  }).timeout(30000);
});
