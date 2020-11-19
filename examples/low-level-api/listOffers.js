const Bluebird = require("bluebird");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const { props: yp, rest, utils } = require("yajsapi");
const { program } = require("commander");

dayjs.extend(utc);

const { Configuration, Market } = rest;
const { asyncWith, CancellationToken } = utils;
const cancellationToken = new CancellationToken();

async function list_offers(conf, subnetTag) {
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

program.option('--subnet-tag <subnet>', 'set subnet name', 'community.3');
program.parse(process.argv);
console.log(`Using subnet: ${program.subnetTag}`);

Bluebird.Promise.any([list_offers(new Configuration(), program.subnetTag), promiseTimeout(4)]);
