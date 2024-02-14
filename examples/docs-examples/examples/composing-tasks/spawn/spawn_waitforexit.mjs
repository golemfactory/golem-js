import { TaskExecutor } from "@golem-sdk/golem-js";

const executor = await TaskExecutor.create({
  // What do you want to run
  package: "golem/alpine:latest",
  yagnaOptions: { apiKey: "try_golem" },
  budget: 0.5,
  maxParallelTasks: 1,
  //payment: { network: "holesky" },
});

// the example will run a tasks 4 times, in sequence (as maxParallelTasks is 1)
for (const i of [1, 2, 3, 4]) {
  await executor.run(async (ctx) => {
    // each task will spawn a script that generates a sequence of 5 pairs of messages sent to stdout and stderr separated by 1 sec delay

    // the command generating the sequence is saved to script.sh file
    await ctx.run(
      `echo 'counter=0; while [ $counter -lt 5 ]; do ls -ls ./script.sh non-existing-file; sleep 1; counter=$(($counter+1)); done
' > script.sh`,
    );
    //permissions are modified to be able to run the script
    await ctx.run("chmod 700 ./script.sh");

    // script is spawned, stdout and stderr are processed
    let remoteProcess = await ctx.spawn("/bin/sh ./script.sh");

    remoteProcess.stdout.on("data", (data) => console.log(`iteration: ${i}:`, "stdout>", data));
    remoteProcess.stderr.on("data", (data) => console.error(`iteration: ${i}:`, "stderr>", data));

    // For odd tasks, we set spawn timeout to 10 secs, (the script will end normally, for equal tasks we will exit the spawn method after 3 secs.
    // The exit caused by timeout will terminate the activity on a provider, therefore the user cannot run another command on the provider. Task executor will run the next task on another provider.

    const timeout = i % 2 === 0 ? 3_000 : 10_000;
    const finalResult = await remoteProcess.waitForExit(timeout).catch(async (e) => {
      console.log(`Iteration: ${i} Error: ${e.message}, Provider: ${e.provider.name}`);
      ctx
        .run("ls -l")
        .catch((e) =>
          console.log("Running command after normal spawn exit is NOT possible, you will get an error:\n", e),
        );
    });
    if (finalResult) {
      // if the spawn exited without timeout, the provider is still available
      console.log(`Iteration: ${i} results: ${finalResult?.result}. Provider: ${ctx.provider.name}`);

      console.log("Running command after normal spawn exit is possible: ", (await ctx.run("ls -l")).stdout);
    }
  });
}

await executor.shutdown();
