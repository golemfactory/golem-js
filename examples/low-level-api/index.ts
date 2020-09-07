import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import * as yp from "../../yajsapi/props";
import { DemandBuilder } from "../../yajsapi/props/builder";
import rest from "../../yajsapi/rest";

dayjs.extend(utc);
const { Configuration, Market } = rest;

async function list_offers(conf: any) {
  let client = await conf.market();
  let market_api = new Market(client);
  let dbuild = new DemandBuilder();
  let idx = new yp.Identification("testnet");
  idx.name.value = "some scanning node";
  dbuild.add(idx);
  let act = new yp.Activity();
  act.expiration.value = dayjs().utc().unix() * 1000;
  dbuild.add(act);

  console.log(dbuild.props(), dbuild.cons())
  let subscription = await market_api.subscribe(dbuild.props(), dbuild.cons());
  for await (let event of subscription.events()) {
    console.log(`Offer: ${event.id()}`);
    console.log(`from ${event.issuer()}`);
    console.log(`props ${JSON.stringify(event.props(), null, 4)}`);
    console.log("\n\n");
  }
  console.log("done");
}

list_offers(new Configuration());
