import { spawn } from "child_process";
import { dirname, basename } from "path";

const examples = [
  { cmd: "node", path: "docs-examples/examples/composing-tasks/batch-end.mjs" },
  { cmd: "node", path: "docs-examples/examples/composing-tasks/batch-endstream-chunks.mjs" },
  { cmd: "node", path: "docs-examples/examples/composing-tasks/batch-endstream-forawait.mjs" },
  { cmd: "node", path: "docs-examples/examples/composing-tasks/multiple-run-prosaic.mjs" },
  { cmd: "node", path: "docs-examples/examples/composing-tasks/singleCommand.mjs" },
];

const criticalLogsRegexp = [/Task timeot/, /Task rejected/, /TODO/];

const timeoutPromise = (seconds) =>
  new Promise((res, rej) =>
    setTimeout(
      () => rej(new Error(`The timeout was reached and the racing promise has rejected after ${seconds} seconds`)),
      seconds * 1000,
    ),
  );

async function test(cmd, path, args = [], timeout = 120) {
  const file = basename(path);
  const cwd = dirname(path);
  const spawnedExample = spawn(cmd, [file, ...args], { stdio: "inherit", cwd });
  const testPromise = new Promise((res, rej) => {
    spawnedExample.on("close", (code, signal) => {
      if (code === 0) return res();
      rej(`Example test exited with code ${code} by signal ${signal}`);
    });
  });
  return Promise.race([timeoutPromise(timeout), testPromise]);
}

async function testAll(examples) {
  try {
    for (const example of examples) {
      console.log(`Starting test for example ${example.path}`);
      await test(example.cmd, example.path, example.args);
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
  process.exit(0);
}
await testAll(examples);
