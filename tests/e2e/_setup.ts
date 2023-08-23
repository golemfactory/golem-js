import { Goth } from "../goth/goth";
import { resolve } from "path";

const timeoutPromise = (seconds: number) =>
  new Promise((_resolve, reject) => {
    setTimeout(
      () => reject(new Error(`The timeout was reached and the racing promise has rejected after ${seconds} seconds`)),
      seconds * 1000,
    );
  });

export default async function setUpGoth() {
  const gothConfig = resolve("../goth/assets/goth-config.yml");
  globalThis.__GOTH = new Goth(gothConfig);

  // Start Goth, but don't wait for an eternity
  return await Promise.race([globalThis.__GOTH.start(), timeoutPromise(180)]);
}
