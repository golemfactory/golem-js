import { TaskExecutor } from "yajsapi";
(async () => {
const executor = await TaskExecutor.create({ package: "28704b5186fb46099b6138e6f1db814a631f6963da456492476d0db9" });
await executor.run(async (ctx) => {
    await ctx.uploadFile("image_description.txt", "/golem/work/image_description.txt");
    var result = (await ctx.run('cat image_description.txt')).stdout;
    console.log(result);
});
await executor.end();
})();
