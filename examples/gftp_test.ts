import { spawn } from "child_process";
const {
  chomp,
  streamWrite,
  streamEnd,
  chunksToLinesAsync,
} = require("@rauschma/stringio");

let childProcess = spawn("gftp", ["server"], {
  shell: true,
});

writeToWritable(childProcess.stdin);

async function writeToWritable(writable) {
  await streamWrite(
    writable,
    '{"jsonrpc": "2.0", "id": "1", "method": "version", "params":{}}\n'
  );
  let result = await echoReadable(childProcess.stdout).next();
  console.log("result", result);
  await streamEnd(writable);
}

async function* echoReadable(readable) {
  for await (const line of chunksToLinesAsync(readable)) {
    yield chomp(line);
  }
}

setTimeout(() => childProcess.kill(), 10000);
