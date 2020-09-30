import Bluebird from "bluebird";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import * as yp from "../../yajsapi/props";
import { DemandBuilder } from "../../yajsapi/props/builder";
import rest from "../../yajsapi/rest";
import asyncWith from "../../yajsapi/utils/asyncWith";
import Token from "../../yajsapi/utils/cancellationToken";

dayjs.extend(utc);
const { Configuration, Market } = rest;
const cancellationToken = new Token();

async function list_offers(conf: any): Promise<void> {
  let client = await conf.market();
  let market_api = new Market(client);
  let dbuild = new DemandBuilder();

  let idx = new yp.Identification("testnet");
  idx.name.value = "some scanning node";
  dbuild.add(idx);

  let act = new yp.Activity();
  act.expiration.value = dayjs().utc().unix() * 1000;
  dbuild.add(act);

  await asyncWith(
    await market_api.subscribe(dbuild.props(), dbuild.cons()),
    async (subscription) => {
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

const sleep = (time) =>
  new Promise((resolve) =>
    setTimeout(() => {
      cancellationToken.cancel();
      resolve();
    }, time * 1000)
  );
Bluebird.Promise.all([list_offers(new Configuration()), sleep(4)]);
