describe("Transfer data example", () => {
  it("should run the example", () => {
    cy.visit("/transfer-data");
    cy.get("#YAGNA_APPKEY").clear().type(Cypress.env("YAGNA_APPKEY"));
    cy.get("#YAGNA_API_BASEPATH").clear().type(Cypress.env("YAGNA_API_BASEPATH"));
    cy.get("#SUBNET_TAG").clear().type(Cypress.env("YAGNA_SUBNET"));
    cy.get("#PAYMENT_NETWORK").clear().type(Cypress.env("PAYMENT_NETWORK"));
    cy.get("#DATA").clear().type("Hello Golem!");
    cy.get("#transfer-data").click();
    cy.get("#results").should("include.text", "hELLO gOLEM!", { timeout: 60000 });
    cy.get("#results").should("include.text", "Finalized renting process", { timeout: 10000 });
  });
});
