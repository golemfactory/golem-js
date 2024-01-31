import { GolemBackend, defaultLogger, GolemInstance } from "@golem-sdk/golem-js";

async function main() {
  const backend = new GolemBackend({
    api: {
      url: process.env.YAGNA_API_URL || "http://127.0.0.1:7465",
      key: process.env.YAGNA_APPKEY || "try-golem",
    },
    image: "golem/alpine:latest",
    market: {
      rentHours: 1,
      priceGlmPerHour: 1,
      expectedInstances: 1,
    },
    logger: defaultLogger("app"),
  });

  backend.events.on("ready", () => console.log("Backend ready"));
  backend.events.on("beforeEnd", () => console.log("Backend about to end"));
  backend.events.on("end", () => console.log("Backend ended"));
  // backend.events.on('activityInitError', (error) => console.log('Activity init error:', error));

  try {
    await backend.start();

    await backend.work(async ({ run }: GolemInstance) => {
      const result = await run('echo "Hello World 1"');
      console.log("RESULT 1:", result.stdout);
    });

    const instance = await backend.createInstance();
    instance.events.on("end", () => console.log("Instance 2 ended"));
    const res1 = await instance.run('echo "Hello"');
    const res2 = await instance.run('echo "World"');
    console.log(`RESULT 2 & 3: ${res1.stdout}${res2.stdout}`);
    await backend.destroyInstance(instance);
  } catch (e) {
    console.error(e);
  } finally {
    await backend.stop();
  }
}

main().catch(console.error);
