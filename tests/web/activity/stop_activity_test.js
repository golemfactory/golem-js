Feature("activity");

Scenario("Stop activity", ({ I }) => {
  I.amOnPage("file:///Users/marcin/dev/golem/yajsapi/tests/web/activity/stop_activity.html");
  I.see("Stop Activity Test", "h2");
  I.click("stop");
  I.see("OK", "#stop_activity");
  I.see("ActivityEnded - OK", "#stop_activity_event");
});
