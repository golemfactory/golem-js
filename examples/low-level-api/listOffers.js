const Bluebird = require("bluebird");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const { props: yp, rest, utils } = require("yajsapi");

dayjs.extend(utc);

const { Configuration, Market } = rest;
const { asyncWith, CancellationToken } = utils;
const cancellationToken = new CancellationToken();

async function list_offers(conf) {
  let client = await conf.market();
  let market_api = new Market(client);
  let dbuild = new yp.DemandBuilder();

  let idx = new yp.Identification("devnet-alpha.2");
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

const promiseTimeout = (seconds) =>
  new Promise((resolve) =>
    setTimeout(() => {
      cancellationToken.cancel();
      resolve();
    }, seconds * 1000)
  );
Bluebird.Promise.any([list_offers(new Configuration()), promiseTimeout(4)]);
