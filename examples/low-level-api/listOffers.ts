import Bluebird from "bluebird";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { props as yp, rest, utils } from "../../yajsapi";
import { Subscription } from "../../yajsapi/rest/market";
import { program } from "commander";

dayjs.extend(utc);

const { Configuration, Market } = rest;
const { asyncWith, CancellationToken } = utils;
const cancellationToken = new CancellationToken();

async function list_offers(conf: rest.Configuration, subnetTag: string): Promise<void> {
  const client = await conf.market();
  const market_api = new Market(client);
  const dbuild = new yp.DemandBuilder();

  const idx = new yp.NodeInfo(subnetTag);
  idx.name.value = "some scanning node";
  dbuild.add(idx);

  const act = new yp.Activity();
  act.expiration.value = dayjs().utc().unix() * 1000;
  dbuild.add(act);

  await asyncWith(
    await market_api.subscribe(dbuild.properties(), dbuild.constraints()),
    async (subscription: Subscription) => {
      for await (const event of subscription.events(cancellationToken)) {
        console.log(`Offer: ${event.id()}`);
        console.log(`from ${event.issuer()}`);
        console.log(`props ${JSON.stringify(event.props(), null, 4)}`);
        console.log("\n\n");
      }
    }
  );
  console.log("done");
}

const promiseTimeout = (seconds: number): Promise<void> =>
  new Promise((resolve) =>
    setTimeout(() => {
      cancellationToken.cancel();
      resolve();
    }, seconds * 1000)
  );

program.option("--subnet-tag <subnet>", "set subnet name", "devnet-beta");
program.parse(process.argv);
const options = program.opts();
console.log(`Using subnet: ${options.subnetTag}`);

Bluebird.Promise.any([list_offers(new Configuration(), options.subnetTag), promiseTimeout(4)]);
