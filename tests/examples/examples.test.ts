import { ChildProcess, spawn } from "child_process";
import { dirname, basename, resolve } from "path";
import { Goth } from "../goth/goth";

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
  const spawnedExample = spawn(cmd, [file, ...args], { stdio: "inherit", cwd });
  spawnedExamples.push(spawnedExample);
  spawnedExample.stdout?.setEncoding("utf-8");
  const testPromise = new Promise((res, rej) => {
    spawnedExample.stdout?.on("data", (data: string) => {
      console.log(data.replace(/[\n\t\r]/g, ""));
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
  let exitCode = 0;
  await Promise.race([goth.start(), timeoutPromise(180)]);
  try {
    for (const example of examples) {
      console.log(`\n---- Starting test for example ${example.path} ----\n`);
      await examplesTest(example.cmd, example.path, example.args);
    }
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    await goth.end().catch((error) => console.error(error));
    spawnedExamples.forEach((example) => example?.kill());
  }
  process.exit(exitCode);
}

testAll(examples).then();
