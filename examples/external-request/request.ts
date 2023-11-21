import { TaskExecutor } from "@golem-sdk/golem-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));

(async function main() {
  const executor = await TaskExecutor.create({
    manifest: Buffer.from(readFileSync(`${__dirname}/manifest.json`, "utf-8")).toString("base64"),
    /**
     * Uncomment this if you have a certificate and a signed manifest
     */
    // manifestSig: readFileSync(`${__dirname}/manifest.json.base64.sign.sha256.base64`, "utf-8"),
    // manifestCert: readFileSync(`${__dirname}/golem-manifest.crt.pem.base64`, "utf-8"),
    // manifestSigAlgorithm: "sha256",
    capabilities: ["inet", "manifest-support"],
  });

  try {
    await executor.run(async (ctx) => {
      const result = await ctx.run(
        "GOLEM_PRICE=`curl -X 'GET' \
        'https://api.coingecko.com/api/v3/simple/price?ids=golem&vs_currencies=usd' \
        -H 'accept: application/json' | jq .golem.usd`; \
        echo \"Golem price: $GOLEM_PRICE USD\";",
      );
      console.log(result.stdout);
    });
  } catch (error) {
    console.error("Computation failed:", error);
  } finally {
    await executor.end();
  }
})();
