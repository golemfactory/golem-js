import { GolemRuntime } from "../../src";
import { LoggerMock } from "../mock";
import path from "path";
import { sleep } from "../../src/utils";

const logger = new LoggerMock(false);

describe("Golem Workers", function () {
  it("run js script file on GolemWorker", async () => {
    let expectedMessage = "";
    let isOnline = false;
    const golemRuntime = new GolemRuntime({ logger });
    const worker = await golemRuntime.startWorker(path.resolve(__dirname, "../mock/fixtures/worker.js"));
    worker.on("message", (msg) => (expectedMessage = msg));
    worker.on("online", () => (isOnline = true));
    await sleep(20);
    expect(isOnline).toBe(true);
    worker.postMessage([5, 7]);
    await sleep(5);
    await worker.terminate();
    expect(expectedMessage).toBe(`5 + 7 = 12`);
    logger.expectToMatch(/Network created/);
    logger.expectToMatch(/Worker Proxy started/);
    logger.expectToMatch(/Websocket opened on/);
    logger.expectToMatch(/Websocket closed/);
  });
});
