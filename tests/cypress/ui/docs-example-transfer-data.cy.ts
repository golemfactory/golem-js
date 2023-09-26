describe("Docs Examples Transfer Data", () => {
  it("should transfer image file to provider", () => {
    cy.visit("/docs-example-transfer-data");
    cy.fixture("golem.png", { encoding: null }).as("imageFile");
    cy.get("#MEME_IMG").selectFile("@imageFile");
    cy.get("#RUN").click();
    cy.get("#RESULT_MEME").should("have.attr", "src").and("contain", "blob:http://localhost:3000", { timeout: 60000 });
    cy.get("#logs").contains("computed by provider");
    cy.get("#logs").contains("Task Executor has shut down");
  });
});
