import { TaskExecutor } from "yajsapi";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",    
    yagnaOptions: { apiKey: 'try_golem' }
  });


  const result = await executor.run(async (ctx) => {

     const res = await ctx
       .beginBatch()
       .uploadFile("./worker.mjs", "/golem/input/worker.mjs")
       .run("node /golem/input/worker.mjs > /golem/input/output.txt")
       .run('cat /golem/input/output.txt')
       .downloadFile("/golem/input/output.txt", "./output.txt")
       .endStream();

       res.on("data", (result) =>  console.log(result));
       res.on("error", (error) => console.error(error));
       res.on("close", () => executor.end());

  });

})();
