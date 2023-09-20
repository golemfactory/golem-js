import { ChildProcess, spawn } from "child_process";
import { dirname, basename, resolve } from "path";
import { Goth } from "../goth/goth";
import chalk from "chalk";

const gothConfig = resolve("../goth/assets/goth-config.yml");
const goth = new Goth(gothConfig);

type Example = {
  cmd: string;
  path: string;
  args?: string[];
  timeout?: number;
};

const examples: Example[] = [
  { cmd: "node", path: "examples/docs-examples/examples/composing-tasks/batch-end.mjs" },
  { cmd: "node", path: "examples/docs-examples/examples/composing-tasks/batch-endstream-chunks.mjs" },
  { cmd: "node", path: "examples/docs-examples/examples/composing-tasks/batch-endstream-forawait.mjs" },
  { cmd: "node", path: "examples/docs-examples/examples/composing-tasks/multiple-run-prosaic.mjs" },
  { cmd: "node", path: "examples/docs-examples/examples/composing-tasks/singleCommand.mjs" },
];

const criticalLogsRegexp = [/Task timeot/, /Task *. has been rejected/, /ERROR: TypeError/];

const timeoutPromise = (seconds: number) =>
  new Promise((res, rej) =>
    setTimeout(
      () => rej(new Error(`The timeout was reached and the racing promise has rejected after ${seconds} seconds`)),
      seconds * 1000,
    ),
  );
const spawnedExamples: ChildProcess[] = [];
async function examplesTest(cmd: string, path: string, args: string[] = [], timeout = 120) {
  const file = basename(path);
  const cwd = dirname(path);
  const spawnedExample = spawn(cmd, [file, ...args], { cwd });
  spawnedExamples.push(spawnedExample);
  spawnedExample.stdout?.setEncoding("utf-8");
  const testPromise = new Promise((res, rej) => {
    spawnedExample.stdout?.on("data", (data: string) => {
      console.log(chalk.cyanBright("[test]"), data.trim());
      if (criticalLogsRegexp.some((regexp) => data.match(regexp))) {
        return rej(`Example test "${file}" failed.`);
      }
    });
    spawnedExample.on("close", (code, signal) => {
      if (code === 0) return res(true);
      rej(`Example test "${file}" exited with code ${code} by signal ${signal}`);
    });
  });
  return Promise.race([timeoutPromise(timeout), testPromise]);
}

async function testAll(examples: Example[]) {
  const failedTests = new Map<string, boolean>();
  await Promise.race([goth.start(), timeoutPromise(180)]);
  for (const example of examples) {
    try {
      console.log(chalk.yellow(`\n\tStarting test for example: "${example.path}"\n`));
      await examplesTest(example.cmd, example.path, example.args);
    } catch (error) {
      console.error(chalk.red(error));
      failedTests.set(example.path, false);
    }
  }
  await goth.end().catch((error) => console.error(error));
  spawnedExamples.forEach((example) => example?.kill());
  console.log(
    chalk.cyan("\n\nTESTS RESULTS: "),
    chalk.bgGreen(`${examples.length - failedTests.size} passed`),
    chalk.bgRed(`${failedTests.size} failed`),
    chalk.bgYellow(`${examples.length} total`),
  );
  process.exit(failedTests.size > 0 ? 1 : 0);
}

testAll(examples).then();
