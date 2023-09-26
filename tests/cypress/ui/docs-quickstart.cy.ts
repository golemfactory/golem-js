describe("Docs Examples Quickstart", () => {
  it("should print hello world", () => {
    cy.visit("/docs-example-quickstart");
    cy.get("#echo").click();
    cy.get("#results").should("include.text", "Hello World", { timeout: 60000 });
    cy.get("#logs").contains("Task Executor has shut down");
  });
});
