describe("Test TaskExecutor API", () => {
  it("should run hello world example", () => {
    cy.visit("/image");
    cy.get("#YAGNA_APPKEY").clear().type(Cypress.env("YAGNA_APPKEY"));
    cy.get("#YAGNA_API_BASEPATH").clear().type(Cypress.env("YAGNA_API_BASEPATH"));
    cy.get("#SUBNET_TAG").clear().type(Cypress.env("YAGNA_SUBNET"));
    cy.get("#PAYMENT_NETWORK").clear().type("rinkeby");
    cy.get("#MEME_IMG").selectFile("image.jpg");
    cy.get("#echo").click();
    cy.get("#results").should("include.text", "Hello World", { timeout: 60000 });
    cy.get("#logs").contains("Task Executor has shut down");
  });
});
