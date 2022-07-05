import { defineConfig } from "cypress";

export default defineConfig({
  fileServerFolder: "examples/web",
  supportFolder: "tests/cypress/support",
  fixturesFolder: "tests/cypress/fixtures",
  e2e: {
    supportFile: "tests/cypress/support/e2e.{js,jsx,ts,tsx}",
    specPattern: "tests/cypress/e2e/**/*.cy.{js,jsx,ts,tsx}",
    setupNodeEvents(on, config) {
      // implement node event listeners here
    },
  },
});
