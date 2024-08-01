import { GolemNetwork, waitFor } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const logger = pinoPrettyLogger({
    level: "info",
  });
  const glm = new GolemNetwork({
    logger,
  });

  try {
    await glm.connect();

    const network = await glm.createNetwork({
      ip: "10.0.0.0/24",
    });

    const rental = await glm.oneOf({
      order: {
        demand: {
          workload: {
            imageTag: "golem/node:20-alpine",
            capabilities: ["vpn"],
          },
        },
        market: {
          rentHours: 0.25,
          pricing: {
            model: "burn-rate",
            avgGlmPerHour: 1,
          },
        },
        network,
      },
    });

    const PORT_ON_PROVIDER = 80;
    const PORT_ON_REQUESTOR = 8080;

    const exe = await rental.getExeUnit();

    // Install the server script
    await exe.uploadFile(`./rental-model/advanced/tcp-proxy/server.js`, "/golem/work/server.js");

    // Start the server process on the provider
    const server = await exe.runAndStream(`PORT=${PORT_ON_PROVIDER} node /golem/work/server.js`);

    server.stdout.subscribe((data) => console.log("provider>", data));
    server.stderr.subscribe((data) => console.error("provider>", data));

    // Create a proxy instance
    const proxy = exe.createTcpProxy(PORT_ON_PROVIDER);
    proxy.events.on("error", (error) => console.error("TcpProxy reported an error:", error));

    // Start listening and expose the port on your requestor machine
    await proxy.listen(PORT_ON_REQUESTOR);
    console.log(`Server Proxy listen at http://localhost:${PORT_ON_REQUESTOR}`);

    let isClosing = false;
    const stopServer = async () => {
      if (isClosing) {
        console.log("Already closing, ignoring subsequent shutdown request");
        return;
      }

      isClosing = true;

      console.log("Shutting down gracefully");
      await proxy.close();
    };

    process.on("SIGINT", () => {
      stopServer()
        .then(() => rental.stopAndFinalize())
        .then(() => logger.info("Shutdown routine completed"))
        .catch((err) => logger.error("Failed to shutdown cleanly", err));
    });

    await waitFor(() => server.isFinished());
  } catch (error) {
    logger.error("Failed to run the example", error);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
