describe("Test TaskExecutor API", () => {
  it("should run hello world example", () => {
    cy.visit("/hello");
    cy.get("#YAGNA_APPKEY").clear().type(Cypress.env("YAGNA_APPKEY"));
    cy.get("#YAGNA_API_BASEPATH").clear().type(Cypress.env("YAGNA_API_BASEPATH"));
    cy.get("#SUBNET_TAG").clear().type(Cypress.env("YAGNA_SUBNET"));
    cy.get("#PAYMENT_NETWORK").clear().type(Cypress.env("PAYMENT_NETWORK"));
    cy.get("#echo").click();
    cy.get("#results").should("include.text", "Hello Golem", { timeout: 60000 });
    cy.get("#results").should("include.text", "Finalized renting process", { timeout: 10000 });
  });
});
