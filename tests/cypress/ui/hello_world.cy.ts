describe("Test TaskExecutor API", () => {
  it("should run hello world example", () => {
    cy.visit("/executor/hello.html");
    cy.get("#YAGNA_APPKEY").clear().type(Cypress.env("YAGNA_APPKEY"));
    cy.get("#YAGNA_API_BASEPATH").clear().type(Cypress.env("YAGNA_API_BASEPATH"));
    cy.get("#SUBNET_TAG").clear().type(Cypress.env("YAGNA_SUBNET"));
    cy.get("#echo").click();
    cy.get("#results").should("include.text", "Hello World");
  });
});
