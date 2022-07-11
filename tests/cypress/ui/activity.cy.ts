describe("Test standalone activity module", () => {
  it("should create activity", () => {
    cy.visit("/activity/command.html");
    cy.contains("YAGNA_APPKEY").type("test_yagna_app_key");
    cy.contains("AGREEMENT_ID").type("test_agreement_id");
    cy.contains("Create Activity").click();
    cy.get("#logs").should("include.text", "Activity created");
  });

  it("should run deploy command", () => {
    cy.visit("/activity/command.html");
    cy.contains("YAGNA_APPKEY").type("test_yagna_app_key");
    cy.contains("AGREEMENT_ID").type("test_agreement_id");
    cy.contains("Create Activity").click();
    cy.contains("Deploy").click();
    cy.get("#logs").should("include.text", "Command Deploy has been executed");
  });

  it("should run exe command", () => {
    cy.visit("/activity/command.html");
    cy.contains("YAGNA_APPKEY").type("test_yagna_app_key");
    cy.contains("AGREEMENT_ID").type("test_agreement_id");
    cy.contains("Create Activity").click();
    cy.contains("Deploy").click();
    cy.contains("Start").click();
    cy.contains("RUN SHELL COMMAND").type('echo "test_result"');
    cy.contains("Execute").click();
    cy.get("#results").should("include.text", "[stdout] test_result");
  });

  it("should get state of activity", () => {
    cy.visit("/activity/command.html");
    cy.contains("YAGNA_APPKEY").type("test_yagna_app_key");
    cy.contains("AGREEMENT_ID").type("test_agreement_id");
    cy.contains("Create Activity").click();
    cy.contains("Get state").click();
    cy.get("#logs").should("include.text", "Activity State: Initialized");
  });

  it("should destroy activity", () => {
    cy.visit("/activity/command.html");
    cy.contains("YAGNA_APPKEY").type("test_yagna_app_key");
    cy.contains("AGREEMENT_ID").type("test_agreement_id");
    cy.contains("Create Activity").click();
    cy.contains("Destroy Activity").click();
    cy.get("#logs").should("include.text", "Activity has been destroyed");
  });

  it("should run exe script", () => {
    cy.visit("/activity/script.html");
    cy.contains("YAGNA_APPKEY").type("test_yagna_app_key");
    cy.contains("AGREEMENT_ID").type("test_agreement_id");
    cy.contains("Create Activity").click();
    cy.contains("RUN SHELL COMMAND").type('echo "test echo 1"');
    cy.contains("Add to script").click();
    cy.contains("RUN SHELL COMMAND").type('echo "test echo 2"');
    cy.contains("Add to script").click();
    cy.window().then((win) => {
      win["activity"].api.setExpectedResult([
        ["stdout", "test echo 1"],
        ["stdout", "test echo 2"],
      ]);
    });
    cy.contains("Execute").click();
    cy.get("#results").should("include.text", "[stdout] test echo 1");
    cy.get("#results").should("include.text", "[stdout] test echo 2");
  });

  it("should run exe script and get results by streaming batch", () => {
    cy.visit("/activity/script_streaming_batch.html");
    cy.contains("YAGNA_APPKEY").type("test_yagna_app_key");
    cy.contains("AGREEMENT_ID").type("test_agreement_id");
    cy.contains("Create Activity").click();
    cy.contains("RUN SHELL COMMAND").type('echo "test event 1"');
    cy.contains("Add to script").click();
    let expectedEvents = [];
    cy.window().then((win) => {
      cy.fixture("activity_events").then((events) => {
        expectedEvents = events;
        win["eventSourceMock"].setExpectedEvents(win["activity"].id, expectedEvents);
      });
    });
    cy.contains("Execute").click();
    cy.get("#results").should("include.text", expectedEvents.join(""));
    cy.get("#logs").should("include.text", "All script commands has been executed");
  });
});
