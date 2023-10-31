import { Worker } from "../../src";
import { LoggerMock } from "../mock";
import path from "path";
import { sleep } from "../../src/utils";

const logger = new LoggerMock(false);

describe("Golem Workers", function () {
  it("run js script file on GolemWorker", async () => {
    let expectedMessage = "";
    let isOnline = false;
    const worker = new Worker(path.resolve("../mocks/fixtures/worker.js"), { logger, enableLogging: true });
    worker.on("message", (msg) => (expectedMessage = msg));
    await sleep(20);
    worker.on("online", () => (isOnline = true));
    expect(isOnline).toBe(true);
    worker.postMessage([5, 7]);
    await sleep(5);
    await worker.terminate();
    expect(expectedMessage).toBe(`5 + 7 = 12`);
    logger.expectToMatch(/Network created/);
    logger.expectToMatch(/Agreement confirmed/);
    logger.expectToMatch(/Allocation has been released/);
  });
});
