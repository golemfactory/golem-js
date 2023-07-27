import { Goth } from "../goth/goth";
import { resolve } from "path";

const gothConfig = resolve("../goth/assets/goth-config.yml");

jest.setTimeout(180 * 1000);

const goth = new Goth(gothConfig);

beforeAll(async function () {
  await goth.start();
});

afterAll(async function () {
  await goth.end();
});
