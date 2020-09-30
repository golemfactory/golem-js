import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import rest from "../yajsapi/rest";

dayjs.extend(utc);
const { Configuration, Market } = rest;

async function unlist_offers(conf: any): Promise<void> {
  let client = await conf.market();
  let market_api = new Market(client);
  for await (let subs of market_api.subscriptions()) {
    subs.delete();
  }
  console.log("done");
}

unlist_offers(new Configuration());
