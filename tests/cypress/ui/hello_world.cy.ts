describe("Test TaskExecutor API", () => {
  it("should run hello world example", () => {
    cy.visit("/executor/hello.html");
    cy.contains("YAGNA_APPKEY").type(Cypress.env("YAGNA_APPKEY"));
    cy.contains("YAGNA_API_BASEPATH").type(Cypress.env("YAGNA_API_URL"));
    cy.contains("YAGNA_SUBNET").type(Cypress.env("YAGNA_SUBNET"));
    cy.contains("Echo Hello World").click();
    cy.get("#results").should("include.text", "Hello World");
    // cy.get("#logs").should("include.text", "Activity created");
  });
});
