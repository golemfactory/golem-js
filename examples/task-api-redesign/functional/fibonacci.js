async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  const fibo = async (ctx, task) => {
    const n = task.data();
    if (n > 1) {
      const result = await ctx.run(`/add.sh ${await fibo(ctx, new Task(n - 1))} ${await fibo(ctx, new Task(n - 2))}`);
      task.accept_result(result);
      return result.stdout;
    } else {
      task.accept_result();
      return "1";
    }
  };
  const result = await golem.run((ctx) => fibo(ctx, new Task(5)));
  console.log(result.stdout);
}
