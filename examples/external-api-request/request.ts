import { TaskExecutor } from "../../dist";
import { readFileSync } from "fs";

(async function main() {
  const executor = await TaskExecutor.create({
    manifest: Buffer.from(readFileSync("manifest.json", "utf-8")).toString("base64"),
    manifestSig: Buffer.from(readFileSync("manifest.json.base64.sha256.sig", "utf-8")).toString("base64"),
    manifestCert: Buffer.from(readFileSync("foo_req.cert.pem", "utf-8")).toString("base64"),
    manifestSigAlgorithm: "sha256",
    capabilities: ["inet", "manifest-support"],
  });
  const results = await executor.run(async (ctx) => {
    const results = await ctx.run(
      "GOLEM_PRICE=`curl -X 'GET' \
                'https://api.coingecko.com/api/v3/simple/price?ids=golem&vs_currencies=usd' \
                -H 'accept: application/json' | jq .golem.usd`; \
            echo ---; \
            echo \"Golem price: $GOLEM_PRICE USD\"; \
            echo ---;"
    );
  });
  console.log(results);
  await executor.end();
})();
