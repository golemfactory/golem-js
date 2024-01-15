import { TaskExecutor } from "@golem-sdk/golem-js";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
const DIR_NAME = fileURLToPath(new URL(".", import.meta.url));

(async function main() {
  // Load the manifest.
  const manifest = await readFile(`${DIR_NAME}/manifest.json`);

  // Create and configure a TaskExecutor instance.
  const executor = await TaskExecutor.create({
    capabilities: ["inet", "manifest-support"],
    manifest: manifest.toString("base64"),
    /**
     * Uncomment this if you have a certificate and a signed manifest
     */
    // manifestSig: (await readFile(`${DIR_NAME}/manifest.json.base64.sign.sha256`)).toString("base64"),
    // manifestCert: (await readFile(`${DIR_NAME}/golem-manifest.crt.pem`)).toString("base64"),
    // manifestSigAlgorithm: "sha256",
  });

  try {
    const url = "https://ipfs.io/ipfs/bafybeihkoviema7g3gxyt6la7vd5ho32ictqbilu3wnlo3rs7ewhnp7lly";
    const results = await executor.run(async (ctx) =>
      ctx
        .beginBatch()
        .run(`curl ${url} -o /golem/work/example.jpg`)
        .downloadFile("/golem/work/example.jpg", `${DIR_NAME}/example.jpg`)
        .end(),
    );
    console.log(results);
  } catch (err) {
    console.error("The task failed due to", err);
  } finally {
    await executor.shutdown();
  }
})();
