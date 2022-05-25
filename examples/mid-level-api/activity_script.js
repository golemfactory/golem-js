const { Activity } = require("../../dist/mid-level-api/activity");
const { Deploy, Start, Run, Terminate, Script } = require("../../dist/mid-level-api/script");

async function main() {
  const activityId = "test_id";
  const credentials = { YAGNA_APPKEY: process.env.YAGNA_APPKEY };
  const activity = new Activity(activityId, { credentials });

  const command1 = new Deploy();
  const command2 = new Start();
  const command3 = new Run("date", "+'DATE1: %d-%m-%Y'");
  const command4 = new Run("date", "+'DATE2: %d-%m-%Y'");
  const command5 = new Run("date", "+'DATE3: %d-%m-%Y'");
  const command6 = new Terminate();

  const script = new Script([command1, command2, command3, command4, command5, command6]);

  const scriptResults = await activity.execute(script);
  for await (const result of scriptResults) {
    console.log(result);
  }
}

main();
