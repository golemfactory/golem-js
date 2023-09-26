describe("Docs Examples Transfer JSON", () => {
  it("should transfer json to provider", () => {
    cy.visit("/docs-example-transfer-json");
    cy.get("#YAGNA_API_BASEPATH").clear().type(Cypress.env("YAGNA_API_BASEPATH"));
    cy.get("#SUBNET_TAG").clear().type(Cypress.env("YAGNA_SUBNET"));
    cy.get("#echo").click();
    cy.get("#results").should("include.text", `"Hello World"`, { timeout: 60000 });
    cy.get("#logs").contains("computed by provider");
    cy.get("#logs").contains("Task Executor has shut down");
  });
});
