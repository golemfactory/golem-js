import { defineConfig } from "cypress";

export default defineConfig({
  fileServerFolder: "examples/web",
  supportFolder: "tests/cypress/support",
  fixturesFolder: "tests/cypress/fixtures",
  videosFolder: ".cypress/video",
  screenshotsFolder: ".cypress/screenshots",
  defaultCommandTimeout: 230000,
  experimentalInteractiveRunEvents: true,
  chromeWebSecurity: false,
  video: true,
  e2e: {
    baseUrl: "http://localhost:3000",
    supportFile: "tests/cypress/support/e2e.ts",
    specPattern: "tests/cypress/ui/**/*.cy.ts",
    setupNodeEvents(on, config) {
      return new Promise(async (res) => {
        config.env.YAGNA_APPKEY = process.env.YAGNA_APPKEY;
        config.env.YAGNA_API_BASEPATH = process.env.YAGNA_API_URL;
        config.env.YAGNA_SUBNET = process.env.YAGNA_SUBNET;
        res(config);
      });
    },
  },
});
