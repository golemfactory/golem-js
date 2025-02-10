import { MarketOrderSpec, GolemNetwork } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";
import net from "net";

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
  });

  try {
    await glm.connect();
    const network = await glm.createNetwork({ ip: "192.168.7.0/24" });
    const order: MarketOrderSpec = {
      demand: {
        workload: {
          imageTag: "golem/alpine:latest",
          capabilities: ["vpn"],
        },
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
      network,
    };
    // create a pool that can grow up to 2 rentals at the same time
    const pool = await glm.manyOf({
      poolSize: 2,
      order,
    });
    const rental1 = await pool.acquire();
    const worker1 = await rental1.getExeUnit();

    // Install the server script on the worker1
    await worker1.uploadFile(`./server.js`, "/golem/work/server.js");

    // Start the server process on the worker1
    const server1 = await worker1.runAndStream(`node /golem/work/server.js`);

    server1.stdout.subscribe((data) => console.log("worker1>", data));
    server1.stderr.subscribe((data) => console.error("worker1>", data));

    // Create a proxy instance
    const proxy1 = worker1.createTcpProxy(5000);
    proxy1.events.on("error", (error) => console.error("TcpProxy reported an error:", error));

    // Start listening and expose the port on your requestor machine
    await proxy1.listen(5000);
    console.log(`Server Proxy listen at http://localhost:5000`);

    const client = new net.Socket();

    client.connect(5000, "127.0.0.1", () => {
      console.log("Connected to proxy");
    });

    client.on("data", (data) => {
      console.log("Received:", data.toString());
    });

    client.write("Hello, world!");

    // Wait 5 seconds before finishing work
    await new Promise((resolve) => setTimeout(resolve, 5000));

    await pool.destroy(rental1);

    await glm.destroyNetwork(network);
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
