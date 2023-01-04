import { defineConfig } from "cypress";
import rollupConfig from "./rollup.config.js";
import { rollup } from "rollup";
import { Goth } from "./tests/integration/goth";
import { resolve } from "path";

const gothConfig = resolve("../goth/assets/goth-config.yml");
const goth = new Goth(gothConfig);

export default defineConfig({
  fileServerFolder: "examples/web",
  supportFolder: "tests/cypress/support",
  fixturesFolder: "tests/cypress/fixtures",
  videosFolder: ".cypress/video",
  experimentalInteractiveRunEvents: true,
  e2e: {
    supportFile: "tests/cypress/support/e2e.ts",
    specPattern: "tests/cypress/ui/**/*.cy.ts",
    setupNodeEvents(on) {
      on("before:run", async () => {
        let bundle;
        try {
          console.log("Trying to compile bundle by rollup.js...");
          bundle = await rollup(rollupConfig);
          await bundle.write(rollupConfig.output);
        } catch (error) {
          console.error(error);
        }
        if (!bundle) throw new Error("Rollup bundle compilation error");
        await bundle.close();
        console.log("Browser bundle has been successfully compiled by rollup");
        const { apiKey, basePath, subnetTag } = await goth.start();
        Cypress.env("YAGNA_APPKEY", apiKey);
        Cypress.env("YAGNA_API_BASEPATH", basePath);
        Cypress.env("YAGNA_SUBNET", subnetTag);
      });
      on("after:run", async () => {
        await goth.end();
      });
    },
  },
});
