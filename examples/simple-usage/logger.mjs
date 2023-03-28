import { TaskExecutor, createJSONLogger, createNullLogger, createDefaultLogger } from "dist/index.js";
import { program, Option } from "commander";

// Create command-line configuration.
program
  .addOption(
    new Option("-l, --log <type>", "Set logger to use")
      .default("text")
      .choices(["text", "json", "null"])
  )
  .option("-d, --debug", "output extra debugging")
  .option("-o, --output <file>", "log output file")
;

// Parse command-line arguments.
program.parse();
const options = program.opts();

// Create logger based on configuration.
function createLogger(options) {
  if (options.log === "text") {
    return createDefaultLogger(options?.output);
  } else if (options.log === "json") {
    return createJSONLogger(options?.output);
  } else {
    return createNullLogger();
  }
}

(async function main(options) {
  const executor = await TaskExecutor.create({
    package: "9a3b5d67b0b27746283cb5f287c13eab1beaa12d92a9f536b747c7ae",
    logger: createLogger(options),
    logLevel: options.debug ? "debug" : "info",
  });

  await executor.run(async (ctx) => console.log((await ctx.run("echo 'Hello World'")).stdout));
  await executor.end();
})(options);
