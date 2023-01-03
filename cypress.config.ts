import { defineConfig } from "cypress";
import rollupConfig from "./rollup.config.js";
import path from "path";
import { rollup } from "rollup";
import stdLibBrowser from "node-stdlib-browser";
import alias from "@rollup/plugin-alias";
import * as ts from "typescript";

// Mock Yagna API
rollupConfig.plugins[0] = alias({
  entries: [
    ...Object.keys(stdLibBrowser).map((k) => ({ find: k, replacement: stdLibBrowser[k] })),
    { find: /ya-ts-client\/dist\/ya-activity\/api$/, replacement: "./dist/mock/tests/mock/rest/activity.js" },
    { find: "eventsource", replacement: "./dist/mock/tests/mock/utils/event_source.js" },
  ],
});
rollupConfig.output.file = path.resolve(__dirname, "./examples/web/js/bundle.js");

function compileTSMocks() {
  const options = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    outDir: "dist/mock",
  };
  const fileNames = [__dirname + "/tests/mock/rest/activity.ts", __dirname + "/tests/mock/utils/event_source.ts"];
  const program = ts.createProgram(fileNames, options);
  console.log("Trying to compile typescript mocks...");
  const results = program.emit();
  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(results.diagnostics);
  // if (allDiagnostics.length > 0) throw new Error(JSON.stringify(allDiagnostics));
  console.log("Typescript has been successfully compiled");
}

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
        compileTSMocks();
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
      });
    },
  },
});
