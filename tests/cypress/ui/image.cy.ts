describe("Test TaskExecutor API", () => {
  it("should run hello world example", () => {
    cy.visit("/image");
    cy.get("#YAGNA_APPKEY").clear().type(Cypress.env("YAGNA_APPKEY"));
    cy.get("#YAGNA_API_BASEPATH").clear().type(Cypress.env("YAGNA_API_BASEPATH"));
    cy.get("#SUBNET_TAG").clear().type(Cypress.env("YAGNA_SUBNET"));
    cy.get("#PAYMENT_NETWORK").clear().type("rinkeby");
    cy.fixture("golem.png", { encoding: null }).as("imageFile");
    cy.get("#MEME_IMG").selectFile("@imageFile");
    cy.get("#RUN").click();
    cy.get("#RESULT_MEME").should("have.attr", "src", "data:image/png;base64,todo", { timeout: 60000 });
    cy.get("#logs").contains("computed by provider");
    cy.get("#logs").contains("Task Executor has shut down");
  });
});
