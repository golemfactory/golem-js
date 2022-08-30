async function main() {
  const golem = new Golem("9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae");
  const fibo = async (ctx, n) => {
    if (n > 1) {
      const result = await ctx.run(`/add.sh ${await fibo(ctx, n - 1)} ${await fibo(ctx, n - 2)}`);
      ctx.acceptResult(result);
      return result.stdout;
    } else {
      ctx.acceptResult();
      return "1";
    }
  };
  const result = await golem.run((ctx) => fibo(ctx, 5));
  console.log(result.stdout);
}
main().catch((e) => console.error(e));
