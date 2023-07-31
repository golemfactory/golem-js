import { TaskExecutor } from "yajsapi";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",    
    yagnaOptions: { apiKey: 'try_golem' }
    , isSubprocess: true
  });


  // there is mistake and instead of 'node -v' we call 'node -w' 
  const result = await executor.run(async (ctx) => (await ctx.run("node -w")));
  console.log("Task result:", result);


  await executor.end();

})();
