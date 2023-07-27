import {Goth} from "../goth/goth";
import {resolve} from "path";

const gothConfig = resolve("../goth/assets/goth-config.yml");

// assert(gothConfig, "Goth was not configured correctly, please run `python -m goth create-assets tests/goth/assets`");

jest.setTimeout(5 * 1000)

const goth = new Goth(gothConfig);

beforeAll(async function () {
    await goth.start();
});

afterAll(async function () {
    await goth.end();
});