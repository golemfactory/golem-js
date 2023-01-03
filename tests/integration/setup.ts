import log from 'why-is-node-running'
import { Goth } from "./goth";
import { resolve } from "path";

const gothConfig = resolve("../goth/assets/goth-config.yml");
const goth = new Goth(gothConfig);

before(async function () {
  this.timeout(60000);
  await goth.start();
});
after(async function () {
  this.timeout(60000);
  await goth.end();
  setTimeout(() => {
    log();
  }, 10000)
  log();
});

beforeEach(function () {
  console.log(`\n\n\xa0\xa0Trying to test: \x1b[32mIt ${this.currentTest?.title} ...\n\n`);
});
