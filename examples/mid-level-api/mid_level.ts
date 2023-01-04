import { Package } from "../../yajsapi/package";
import { Allocation } from "../../yajsapi/payment";
import { Demand, DemandEvent, DemandEventType, Proposal } from "../../yajsapi/market";
import { Agreement } from "../../yajsapi/agreement";
import { Activity, Result } from "../../yajsapi/activity";
import { Deploy, Run, Script, Start } from "../../yajsapi/script";
import { ConsoleLogger } from "../../yajsapi/utils";

const subnetTag = "devnet-beta";
const account = { platform: "erc20-rinkeby-tglm", address: "0x19ee20338a4c4bf8f6aebc79d9d3af2a01434119" };
const imageHash = "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae";
const logger = new ConsoleLogger();

async function main() {
  const taskPackage = await Package.create({ imageHash });
  const allocation = await Allocation.create({ account, logger });
  const demand = await Demand.create(taskPackage, [allocation], { subnetTag, logger });
  const offer: Proposal = await new Promise((res) =>
    demand.addEventListener(DemandEventType, async (event) => {
      const proposalEvent = event as DemandEvent;
      if (proposalEvent.proposal.isInitial()) await proposalEvent.proposal.respond(account.platform);
      else if (proposalEvent.proposal.isDraft()) res(proposalEvent.proposal);
    })
  );
  const agreement = await Agreement.create(offer.id, { logger });
  await agreement.confirm();
  const activity = await Activity.create(agreement.id, { logger });
  const script = await Script.create([new Deploy(), new Start(), new Run("/bin/sh", ["-c", "echo 'Hello Golem'"])]);
  const exeScript = script.getExeScriptRequest();
  const streamResult = await activity.execute(exeScript);
  const results: Result[] = [];
  for await (const result of streamResult) results.push(result);
  console.log(results[2].stdout);
  await activity.stop();
  await agreement.terminate();
  await allocation.release();
  await demand.unsubscribe();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
