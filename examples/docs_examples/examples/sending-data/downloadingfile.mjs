import { TaskExecutor } from "yajsapi";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",    
    yagnaOptions: { apiKey: 'try_golem' }
  });




  const result = await executor.run(async (ctx) => {

     const res = await ctx
       .beginBatch()
       .run("ls -l /golem > /golem/work/output.txt")
       .run('cat /golem/work/output.txt')
       .downloadFile("/golem/work/output.txt", "./output.txt")
       .end()
       .catch((error) => console.error(error));

       return res[2]?.stdout

  });

  console.log(result);
  await executor.end();

})();
