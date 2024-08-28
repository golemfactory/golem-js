import { spawn } from "child_process";
import { dirname, basename, resolve } from "path";
import chalk from "chalk";
import testExamples from "./examples.json";
import * as wtf from "wtfnode";

const criticalLogsRegExp = [
  /GolemInternalError/,
  /GolemPlatformError/,
  /GolemWorkError/,
  /ERROR: TypeError/,
  /ERROR: Error/gim,
];

type Example = {
  cmd: string;
  path: string;
  args?: string[];
  timeout?: number;
  skip?: boolean;
};

const exitOnError = process.argv.includes("--exitOnError");

async function test(cmd: string, path: string, args: string[] = [], timeout = 360) {
  const file = basename(path);
  const cwd = dirname(path);
  const env = { ...process.env, DEBUG: "golem-js:*" };
  const spawnedExample = spawn(cmd, [file, ...args], { cwd, env });
  spawnedExample.stdout?.setEncoding("utf-8");
  spawnedExample.stderr?.setEncoding("utf-8");
  let error = "";
  const timeoutId = setTimeout(() => {
    error = `Test timeout was reached after ${timeout} seconds.`;
    wtf.dump();
    spawnedExample.kill();
  }, timeout * 1000);
  return new Promise((res, rej) => {
    const assertLogs = (data: string) => {
      console.log(data.trim());
      const logWithoutColors = data.replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        "",
      );
      if (criticalLogsRegExp.some((regexp) => logWithoutColors.match(regexp))) {
        error = `A critical error occurred during the test. ${logWithoutColors}`;
        spawnedExample.kill();
      }
    };
    spawnedExample.stdout?.on("data", assertLogs);
    spawnedExample.stderr?.on("data", assertLogs);
    spawnedExample.on("close", (code) => {
      if (!error && !code) return res(true);
      rej(`Test example "${file}" failed. ${error}`);
    });
  }).finally(() => {
    clearTimeout(timeoutId);
    spawnedExample.kill("SIGKILL");
  });
}

async function testAll(examples: Example[]) {
  const failedTests = new Set<string>();
  const skippedTests = new Set<string>();
  for (const example of examples) {
    try {
      console.log(chalk.yellow(`\n---- Starting test: "${example.path}" ----\n`));
      if (example?.skip) {
        console.log(chalk.bgYellow.black(" SKIP "), chalk.yellowBright(example.path));
        skippedTests.add(example.path);
      } else {
        await test(example.cmd, example.path, example.args, example.timeout);
        console.log(chalk.bgGreen.white(" PASS "), chalk.green(example.path));
      }
    } catch (error) {
      console.log(chalk.bgRed.white(" FAIL "), chalk.red(error));
      if (exitOnError) {
        console.log(chalk.bold.red(`\nExiting due to error in: "${example.path}"\n`));
        process.exit(1);
      }
      failedTests.add(example.path);
    }
  }
  console.log(
    chalk.bold.yellow("\n\nTESTS RESULTS: "),
    chalk.bgGreen.black(`  ${examples.length - failedTests.size - skippedTests.size} passed  `),
    chalk.bgRed.black(`  ${failedTests.size} failed  `),
    skippedTests.size ? chalk.bgYellow.black(`  ${skippedTests.size} skipped  `) : "",
    chalk.bgCyan.black(`  ${examples.length} total  `),
  );
  console.log(chalk.red("\nFailed tests:"));
  failedTests.forEach((test) => console.log(chalk.red(`\t- ${test}`)));
  console.log(chalk.yellow("\nSkipped tests:"));
  skippedTests.forEach((test) => console.log(chalk.yellow(`\t- ${test}`)));
  process.exit(failedTests.size > 0 ? 1 : 0);
}

testAll(testExamples).then();
