import { defineConfig } from "cypress";
import rollupConfig from "./rollup.config.js";
import path from "path";
import { rollup } from "rollup";
import stdLibBrowser from "node-stdlib-browser";
import alias from "@rollup/plugin-alias";

// Mock Yagna API
rollupConfig.plugins[0] = alias({
  entries: [
    ...Object.keys(stdLibBrowser).map((k) => ({ find: k, replacement: stdLibBrowser[k] })),
    { find: /ya-ts-client\/dist\/ya-activity\/api$/, replacement: "./dist/tests/mock/activity_api.js" },
    { find: "eventsource", replacement: "./dist/tests/mock/event_source.js" },
  ],
});
rollupConfig.output.file = path.resolve(__dirname, "./examples/web/js/bundle.js");

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
        console.log("Browser bundle compiled by rollup");
      });
    },
  },
});
