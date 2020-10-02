import { spawn } from "child_process";
const {
  chomp,
  streamWrite,
  streamEnd,
  chunksToLinesAsync,
} = require("@rauschma/stringio");

const childProcess = spawn("gftp", ["server"], {
  shell: true,
});

writeToWritable(childProcess.stdin);

async function writeToWritable(writable) {
  await streamWrite(
    writable,
    '{"jsonrpc": "2.0", "id": "1", "method": "version", "params":{}}\n'
  );
  const { value } = await echoReadable(childProcess.stdout).next();
  const { result } = JSON.parse(value);
  console.log('Output', value);
  console.log('GFTP', `v${result}`);
  await streamEnd(writable);
}

async function* echoReadable(readable) {
  for await (const line of chunksToLinesAsync(readable)) {
    yield chomp(line);
  }
}

setTimeout(() => childProcess.kill(), 10000);
