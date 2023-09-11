import { TaskExecutor } from "@golem-sdk/golem-js";

(async () => {
  const executor = await TaskExecutor.create({
    package: "529f7fdaf1cf46ce3126eb6bbcd3b213c314fe8fe884914f5d1106d4",    
    yagnaOptions: { apiKey: 'try_golem' }
  });

 const data = [1, 2, 3, 4, 5];

 const results = executor.map(data, (ctx, item) => ctx.run(`echo "${item}"`));

 for await (const result of results) console.log(result.stdout);
   
 await executor.end(); 
    
  
})();