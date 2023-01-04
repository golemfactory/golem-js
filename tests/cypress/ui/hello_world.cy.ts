describe("Test TaskExecutor API", () => {
  it("should run hello world example", () => {
    cy.log(Cypress.env() as any)
    cy.visit("/executor/hello.html");
    cy.get("#YAGNA_APPKEY").clear().type(Cypress.env("YAGNA_APPKEY"));
    cy.get("#YAGNA_API_BASEPATH").clear().type(Cypress.env("YAGNA_API_BASEPATH"));
    cy.get("#SUBNET_TAG").clear().type(Cypress.env("YAGNA_SUBNET"));
    cy.get("#echo").click().debug();
    cy.wait(15000);
    cy.get("#results").should("include.text", "Hello World");
    // cy.get("#logs").should("include.text", "Activity created");
  });
});
