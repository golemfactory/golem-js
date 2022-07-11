import { defineConfig } from "cypress";
import webpackConfig from "./webpack.config.js";
import path from "path";
import { webpack } from "webpack";

webpackConfig.output.path = path.resolve(__dirname, "./examples/web/js");
webpackConfig.resolve.alias["ya-ts-client/dist/ya-activity/api$"] = path.resolve(
  __dirname,
  "tests/mock/activity_api.ts"
);
webpackConfig.resolve.alias["eventsource"] = path.resolve(__dirname, "tests/mock/event_source.ts");
webpackConfig.resolve.fallback["eventsource"] = path.resolve(__dirname, "tests/mock/event_source.ts");

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
      on("before:run", () => {
        webpack(webpackConfig, (err, stats) => {
          if (err) {
            throw err;
          }
          const info = stats?.toJson();
          if (stats?.hasErrors()) {
            throw info?.errors;
          }
          if (stats?.hasWarnings()) {
            console.warn(info?.warnings);
          }
        });
      });
    },
  },
});
