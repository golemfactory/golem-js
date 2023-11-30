import { TaskExecutor, jsonLogger, nullLogger, defaultLogger } from "@golem-sdk/golem-js";
import { program, Option } from "commander";

// Create command-line configuration.
program
  .addOption(new Option("-l, --log <type>", "Set logger to use").default("text").choices(["text", "json", "null"]))
  .option("-d, --debug", "output extra debugging")
  .option("-o, --output <file>", "log output file");

// Parse command-line arguments.
program.parse();
const options = program.opts();

// Create logger based on configuration.
function createLogger(options) {
  if (options.log === "text") {
    return defaultLogger(options?.output);
  } else if (options.log === "json") {
    return jsonLogger(options?.output);
  } else {
    return nullLogger();
  }
}

(async function main(options) {
  const executor = await TaskExecutor.create({
    package: "golem/alpine:latest",
    logger: createLogger(options),
    logLevel: options.debug ? "debug" : "info",
  });

  try {
    await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  } catch (err) {
    console.error("Error while running the task:", err);
  } finally {
    await executor.shutdown();
  }
})(options);
