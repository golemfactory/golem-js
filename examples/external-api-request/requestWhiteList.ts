import { TaskExecutor } from "../../dist";
import { readFileSync } from "fs";

(async function main() {
  const executor = await TaskExecutor.create({
    manifest: readFileSync("manifest.json", "utf-8"),
    manifestSig: readFileSync("manifest.json.base64.sign.sha256.base64", "utf-8"),
    manifestCert: readFileSync("cert.chain.pem.base64", "utf-8"),
    manifestSigAlgorithm: "sha256",
    capabilities: ["inet", "manifest-support"],
    subnetTag: "public",
  });
  await executor.run(async (ctx) => {
    const results = await ctx.run(
      "GOLEM_PRICE=`curl -X 'GET' \
                'https://api.coingecko.com/api/v3/simple/price?ids=golem&vs_currencies=usd' \
                -H 'accept: application/json' | jq .golem.usd`; \
            echo ---; \
            echo \"Golem price: $GOLEM_PRICE USD\"; \
            echo ---;"
    );
    console.log(results);
  });
  await executor.end();
})();
