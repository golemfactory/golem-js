// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import "./commands";
import { webpack } from "webpack";
import path from "path";

before(() => {
  webpack(
    {
      output: {
        filename: "bundle2.js",
        // path: path.resolve(__dirname, "tests/web/activity"),
        path: path.resolve(__dirname, "examples/web"),
        library: "yajsapi",
      },
    },
    (err, stats) => {
      if (err) {
        throw err;
      }
      const info = stats.toJson();
      if (stats.hasErrors()) {
        throw info.errors;
      }
      if (stats.hasWarnings()) {
        console.warn(info.warnings);
      }
    }
  );
});
