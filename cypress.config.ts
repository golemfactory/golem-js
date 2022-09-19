import { defineConfig } from "cypress";
import webpackConfig from "./webpack.config.js";
import path from "path";
import { webpack } from "webpack";
import { existsSync } from "fs";

webpackConfig.output.path = path.resolve(__dirname, "./examples/web/js");
webpackConfig.resolve.alias["ya-ts-client/dist/ya-activity/api$"] = path.resolve(
  __dirname,
  "tests/mock/activity_api.ts"
);
webpackConfig.resolve.alias["eventsource"] = path.resolve(__dirname, "tests/mock/event_source.ts");
webpackConfig.resolve.fallback["eventsource"] = path.resolve(__dirname, "tests/mock/event_source.ts");

export default defineConfig({
  projectId: "dm6cbd",
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
        webpack(webpackConfig, (err, stats) => {
          if (err) throw err;
        });
        let isCompiled = false;
        let timeout = false;
        setTimeout(() => (timeout = true), 60000);
        while (!isCompiled && !timeout) {
          isCompiled = existsSync(path.resolve(webpackConfig.output.path, webpackConfig.output.filename));
          console.log("Waiting for webpack...");
          await new Promise((res) => setTimeout(res, 1000));
        }
        isCompiled && console.log("Webpack compiled");
        if (timeout && !isCompiled) {
          throw new Error("Webpack compilation timeout");
        }
      });
    },
  },
});
