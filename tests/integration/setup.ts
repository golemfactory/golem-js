import {Goth} from "./goth";
import {resolve} from "path";

const gothConfig = resolve("../goth/assets/goth-config.yml");
const goth = new Goth(gothConfig);

before(async function() {
    this.timeout(60000);
    await goth.start().catch(e => {
        console.error(e);
        throw e;
    });
});
after(async function () {
    this.timeout(60000);
    await goth.end();
});

beforeEach(function () {
    console.log(`\n\n\tTrying to test: \x1b[32m${this.currentTest?.parent?.title} ${this.currentTest?.title} ...\n\n`)
});