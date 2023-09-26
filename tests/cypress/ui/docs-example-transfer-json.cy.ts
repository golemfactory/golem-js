describe("Docs Examples Transfer JSON", () => {
  it("should transfer json to provider", () => {
    cy.visit("/docs-example-transfer-json");
    cy.get("#echo").click();
    cy.get("#results").should("include.text", "TODO", { timeout: 60000 });
    cy.get("#logs").contains("computed by provider");
    cy.get("#logs").contains("Task Executor has shut down");
  });
});
