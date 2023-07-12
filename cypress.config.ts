import { defineConfig } from "cypress";
import { Goth } from "./tests/goth/goth";
import { resolve } from "path";

const gothConfig = resolve("../goth/assets/goth-config.yml");
const goth = new Goth(gothConfig);

export default defineConfig({
  fileServerFolder: "examples/web",
  supportFolder: "tests/cypress/support",
  fixturesFolder: "tests/cypress/fixtures",
  videosFolder: ".cypress/video",
  screenshotsFolder: ".cypress/screenshots",
  defaultCommandTimeout: 90000,
  experimentalInteractiveRunEvents: true,
  chromeWebSecurity: false,
  e2e: {
    baseUrl: "http://localhost:3000",
    supportFile: "tests/cypress/support/e2e.ts",
    specPattern: "tests/cypress/ui/**/*.cy.ts",
    setupNodeEvents(on, config) {
      on("after:run", async () => {
        await goth.end();
      });
      return new Promise(async (res) => {
        const { apiKey, basePath, subnetTag } = await goth.start();
        config.env.YAGNA_APPKEY = apiKey;
        config.env.YAGNA_API_BASEPATH = basePath;
        config.env.YAGNA_SUBNET = subnetTag;
        res(config);
      });
    },
  },
});
