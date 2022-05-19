Feature("activity");

Scenario("Create activity", ({ I }) => {
  I.amOnPage("file:///Users/marcin/dev/golem/yajsapi/tests/web/activity/create_activity.html");
  I.see("Create Activity Test", "h2");
  I.click("create");
  I.waitForText("OK", 1, "#create_activity");
  I.see("OK", "#create_activity");
});
