import { spawn } from "child_process";
import { dirname, basename, resolve } from "path";
import { Goth } from "../goth/goth";
import chalk from "chalk";
import testExamples from "./examples.json";

const noGoth = process.argv[2] === "--no-goth";
const gothConfig = resolve("../goth/assets/goth-config.yml");
const gothStartingTimeout = 180;
const goth = new Goth(gothConfig);

const examples = !noGoth ? testExamples.filter((e) => !e?.noGoth) : testExamples;

const criticalLogsRegExp = [/Task timeot/, /Task *. has been rejected/, /ERROR: TypeError/];

type Example = {
  cmd: string;
  path: string;
  args?: string[];
  timeout?: number;
};

async function test(cmd: string, path: string, args: string[] = [], timeout = 180) {
  const file = basename(path);
  const cwd = dirname(path);
  const spawnedExample = spawn(cmd, [file, ...args], { cwd });
  spawnedExample.stdout?.setEncoding("utf-8");
  const timeoutId = setTimeout(() => {
    spawnedExample.kill("SIGABRT");
  }, timeout * 1000);
  return new Promise((res, rej) => {
    spawnedExample.stdout?.on("data", (data: string) => {
      console.log(data.trim());
      if (criticalLogsRegExp.some((regexp) => data.match(regexp))) {
        spawnedExample.kill("SIGKILL");
      }
    });
    spawnedExample.on("close", (code, signal) => {
      if (signal === null) return res(true);
      let errorMsg = "";
      if (signal === "SIGABRT") errorMsg = `Test timeout was reached after ${timeout} seconds.`;
      if (signal === "SIGKILL") errorMsg = `A critical error occurred during the test.`;
      rej(`Test example "${file}" failed. ${errorMsg}`);
    });
  }).finally(() => {
    clearTimeout(timeoutId);
    spawnedExample.kill();
  });
}

async function testAll(examples: Example[]) {
  const failedTests = new Set<string>();
  if (!noGoth)
    await Promise.race([
      goth.start(),
      new Promise((res, rej) =>
        setTimeout(
          () => rej(new Error(`The Goth starting timeout was reached after ${gothStartingTimeout} seconds`)),
          gothStartingTimeout * 1000,
        ),
      ),
    ]);
  for (const example of examples) {
    try {
      console.log(chalk.yellow(`\n---- Starting test: "${example.path}" ----\n`));
      await test(example.cmd, example.path, example.args, example.timeout);
    } catch (error) {
      console.error(chalk.bgRed.white(" FAIL "), chalk.red(error));
      failedTests.add(example.path);
    }
  }
  if (!noGoth) await goth.end().catch((error) => console.error(error));
  console.log(
    chalk.bold.yellow("\n\nTESTS RESULTS: "),
    chalk.bgGreen.black(`  ${examples.length - failedTests.size} passed  `),
    chalk.bgRed.black(`  ${failedTests.size} failed  `),
    chalk.bgCyan.black(`  ${examples.length} total  `),
  );
  console.log(chalk.red("\nFailed tests:"));
  failedTests.forEach((test) => console.log(chalk.red(`\t- ${test}`)));
  process.exit(failedTests.size > 0 ? 1 : 0);
}

testAll(examples).then();
