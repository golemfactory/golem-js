import { Goth } from "./goth";
import { resolve } from "path";
const gothConfig = resolve("../goth/assets/goth-config-testing.yml");
const goth = new Goth(gothConfig);

async function main() {
  const { apiKey, basePath, subnetTag } = await goth.start();
  console.log({ apiKey, basePath, subnetTag });
}
main().catch((e) => {
  console.log(e);
});
