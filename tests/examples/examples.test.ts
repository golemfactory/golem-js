import { spawn } from "child_process";
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
  { cmd: "node", path: "docs-examples/examples/composing-tasks/batch-endstream-chunks.mjs" },
  { cmd: "node", path: "docs-examples/examples/composing-tasks/batch-endstream-forawait.mjs" },
  { cmd: "node", path: "docs-examples/examples/composing-tasks/multiple-run-prosaic.mjs" },
  { cmd: "node", path: "docs-examples/examples/composing-tasks/singleCommand.mjs" },
];

const criticalLogsRegexp = [/Task timeot/, /Task rejected/, /TODO/];

const timeoutPromise = (seconds: number) =>
  new Promise((res, rej) =>
    setTimeout(
      () => rej(new Error(`The timeout was reached and the racing promise has rejected after ${seconds} seconds`)),
      seconds * 1000,
    ),
  );

async function examplesTest(cmd: string, path: string, args: string[] = [], timeout = 120) {
  const file = basename(path);
  const cwd = dirname(path);
  const spawnedExample = spawn(cmd, [file, ...args], { stdio: "inherit", cwd });
  const testPromise = new Promise((res, rej) => {
    spawnedExample.on("close", (code, signal) => {
      if (code === 0) return res(true);
      rej(`Example test "${file}" exited with code ${code} by signal ${signal}`);
    });
  });
  return Promise.race([timeoutPromise(timeout), testPromise]);
}

async function testAll(examples: Example[]) {
  await Promise.race([goth.start(), timeoutPromise(180)]);
  try {
    for (const example of examples) {
      console.log(`Starting test for example ${example.path}`);
      await examplesTest(example.cmd, example.path, example.args);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
  process.exit(0);
}

testAll(examples).then();
