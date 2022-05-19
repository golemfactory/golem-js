Feature("activity");

Scenario("Execute activity", ({ I }) => {
  I.amOnPage("file:///Users/marcin/dev/golem/yajsapi/tests/web/activity/execute_activity.html");
  I.see("Execute Activity Test", "h2");
  I.click("execute");
  I.waitForText("OK", 6, "#execute_activity");
  I.see("OK", "#execute_activity");

  I.see("ScriptSent", "#events > li");
  I.see("ScriptExecuted", "#events > li");
  I.see("ScriptExecuted", "#events > li");
  I.see("StateChanged: Initialized", "#events > li");
  I.waitForText("StateChanged: Deployed", 6, "#events > li");
  I.waitForText("StateChanged: Terminated", 10, "#events > li");
});
