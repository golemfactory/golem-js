Feature("activity");

Scenario("Get activity state", ({ I }) => {
  I.amOnPage("file:///Users/marcin/dev/golem/yajsapi/tests/web/activity/get_state_activity.html");
  I.see("Get Activity State Test", "h2");
  I.click("#get_state");
  I.see("Ready", "#activity_state");
});
