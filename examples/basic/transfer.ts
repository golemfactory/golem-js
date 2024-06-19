import { MarketOrderSpec, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";
import { appendFile, readFile, unlink } from "fs/promises";

const order: MarketOrderSpec = {
  demand: {
    workload: { imageTag: "golem/alpine:latest" },
  },
  market: {
    rentHours: 0.5,
    pricing: {
      model: "linear",
      maxStartPrice: 0.5,
      maxCpuPerHourPrice: 1.0,
      maxEnvPerHourPrice: 0.5,
    },
  },
};

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
  });

  try {
    await glm.connect();
    const pool = await glm.manyOf({
      concurrency: 2,
      order,
    });
    const rental1 = await pool.acquire();
    const rental2 = await pool.acquire();

    const exe1 = await rental1.getExeUnit();
    const exe2 = await rental2.getExeUnit();

    await exe1
      .beginBatch()
      .run(`echo "Message from provider ${exe1.provider.name}. Hello 😻" >> /golem/work/message.txt`)
      .downloadFile("/golem/work/message.txt", "./message.txt")
      .end();

    await appendFile("./message.txt", "Message from requestor. Hello 🤠\n");

    await exe2
      .beginBatch()
      .uploadFile("./message.txt", "/golem/work/message.txt")
      .run(`echo "Message from provider ${exe2.provider.name}. Hello 👻" >> /golem/work/message.txt`)
      .downloadFile("/golem/work/message.txt", "./results.txt")
      .end();

    console.log("File content: ");
    console.log(await readFile("./results.txt", { encoding: "utf-8" }));

    await rental1.stopAndFinalize();
    await rental2.stopAndFinalize();
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
    await unlink("./message.txt");
    await unlink("./results.txt");
  }
})().catch(console.error);
