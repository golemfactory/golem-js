import { TaskExecutor } from "yajsapi";
import * as fs from 'fs';


(async () => {
  const executor = await TaskExecutor.create({
    package: "dcd99a5904bebf7ca655a833b73cc42b67fd40b4a111572e3d2007c3",    
    yagnaOptions: { apiKey: 'try_golem' }
  });

//const buff = fs.readFileSync('worker.mjs'); 
//const hash = createHash('md5').update(buff).digest('hex');

  await executor.run(async (ctx) => {

    // Upload test JSON object
    await ctx.uploadJson({ "input": "Hello World" }, '/golem/input/input.json');

    // failes after this command

    // Modify sent JSON to replace the input key with output
    //await ctx.run("cat /golem/input/input.json | sed s/input/output/ > /golem/work/output.json");

    // Download the JSON object.
    //const output = await ctx.downloadJson('/golem/work/output.json');

    //const res  = await ctx.run(`node -e "const crypto = require('node:crypto'); const fs = require('fs'); const buff = fs.readFileSync('/golem/input/worker.mjs'); const hash = crypto.createHash('md5').update(buff).digest('hex'); console.log(hash); "`).catch((error) => console.error(error));

  });

  //const buff = fs.readFileSync('output.json'); 
  //console.log(buff);

  await executor.end();

})();

