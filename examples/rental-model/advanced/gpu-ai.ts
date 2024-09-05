import { GolemNetwork, MarketOrderSpec, waitFor } from "@golem-sdk/golem-js";
import { pinoPrettyLogger } from "@golem-sdk/pino-logger";

(async () => {
  const glm = new GolemNetwork({
    logger: pinoPrettyLogger({
      level: "info",
    }),
  });

  try {
    await glm.connect();
    const network = await glm.createNetwork({ ip: "192.168.0.0/24" });

    const abortController = new AbortController();
    const signal = abortController.signal;
    process.on("SIGINT", () => abortController.abort("Process interrupted at user request"));

    const order: MarketOrderSpec = {
      demand: {
        workload: {
          // ollama with qwen2:0.5b
          imageHash: "23ac8d8f54623ad414d70392e4e3b96da177911b0143339819ec1433",
          minMemGib: 8,
          capabilities: ["!exp:gpu", "vpn"],
          runtime: { name: "vm-nvidia" },
        },
      },
      market: {
        rentHours: 0.5,
        pricing: {
          model: "linear",
          maxStartPrice: 0.0,
          maxCpuPerHourPrice: 0.0,
          maxEnvPerHourPrice: 2.0,
        },
      },
      network,
    };

    const rental = await glm.oneOf({ order, signalOrTimeout: signal });
    const exe = await rental.getExeUnit(signal);

    const PORT_ON_PROVIDER = 11434; // default port
    const PORT_ON_REQUESTOR = 11434; // will use the same outside
    let isServerReady = false;

    console.log("Will start ollama on provider", exe.provider.name);

    const server = await exe.runAndStream("sleep 1 && /usr/bin/ollama serve", {
      signalOrTimeout: signal,
    });

    server.stdout.subscribe((data) => console.log("provider>", data));
    server.stderr.subscribe((data) => {
      console.log("provider>", data);
      if (data?.toString().includes("Listening on [::]:11434")) {
        isServerReady = true;
      }
    });

    await waitFor(() => isServerReady, { abortSignal: signal });

    const proxy = exe.createTcpProxy(PORT_ON_PROVIDER);
    proxy.events.on("error", (error) => console.error("TcpProxy reported an error:", error));

    await proxy.listen(PORT_ON_REQUESTOR);
    console.log(`Server Proxy listen at http://localhost:${PORT_ON_REQUESTOR}`);

    let isClosing = false;
    const stopServer = async () => {
      if (isClosing) {
        console.log("Already closing, ignoring subsequent shutdown request. Process PID: %d", process.pid);
        return;
      }
      isClosing = true;
      console.log("Shutting down gracefully");
      await proxy.close();
    };

    abortController.signal.addEventListener("abort", () => stopServer().then(() => rental.stopAndFinalize()));

    await waitFor(() => server.isFinished(), { abortSignal: AbortSignal.timeout(120_000) });
  } catch (err) {
    console.error("Failed to run the example", err);
  } finally {
    await glm.disconnect();
  }
})().catch(console.error);
