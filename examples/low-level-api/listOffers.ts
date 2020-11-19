import Bluebird from "bluebird";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { props as yp, rest, utils } from "yajsapi";
import { Subscription } from "yajsapi/dist/rest/market";
import { program } from "commander";

dayjs.extend(utc);

const { Configuration, Market } = rest;
const { asyncWith, CancellationToken } = utils;
const cancellationToken = new CancellationToken();

async function list_offers(conf: rest.Configuration, subnetTag: string): Promise<void> {
  let client = await conf.market();
  let market_api = new Market(client);
  let dbuild = new yp.DemandBuilder();

  let idx = new yp.Identification(subnetTag);
  idx.name.value = "some scanning node";
  dbuild.add(idx);

  let act = new yp.Activity();
  act.expiration.value = dayjs().utc().unix() * 1000;
  dbuild.add(act);

  await asyncWith(
    await market_api.subscribe(dbuild.props(), dbuild.cons()),
    async (subscription: Subscription) => {
      for await (let event of subscription.events(cancellationToken)) {
        console.log(`Offer: ${event.id()}`);
        console.log(`from ${event.issuer()}`);
        console.log(`props ${JSON.stringify(event.props(), null, 4)}`);
        console.log("\n\n");
      }
    }
  );
  console.log("done");
}

const promiseTimeout = (seconds: number) =>
  new Promise((resolve) =>
    setTimeout(() => {
      cancellationToken.cancel();
      resolve();
    }, seconds * 1000)
  );

program.option('--subnet-tag <subnet>', 'set subnet name', 'community.3');
program.parse(process.argv);
console.log(`Using subnet: ${program.subnetTag}`);

Bluebird.Promise.any([list_offers(new Configuration(), program.subnetTag), promiseTimeout(4)]);
