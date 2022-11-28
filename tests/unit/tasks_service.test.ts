import rewiremock from "rewiremock";
import { RequestorControlApiMock, RequestorSateApiMock, setExpectedExeResults } from "../mock/activity_api";
rewiremock("ya-ts-client/dist/ya-activity/api").with({
  RequestorControlApi: RequestorControlApiMock,
  RequestorStateApi: RequestorSateApiMock,
});
rewiremock.enable();
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Task, TaskQueue, TaskService, Worker } from "../../yajsapi/task";
import { agreementPoolServiceMock, paymentServiceMock, LoggerMock } from "../mock";
import { Result } from "../../yajsapi/activity";
chai.use(chaiAsPromised);
const expect = chai.expect;
const queue = new TaskQueue<Task<null, Result>>();
const logger = new LoggerMock();

describe("Task Service", () => {
  it("should process new task in queue", async () => {
    const worker: Worker<null, Result> = async (ctx) => ctx.run("some_shell_command");
    const task = new Task<null, Result>(worker);
    queue.addToEnd(task);
    setExpectedExeResults([["stdout", "some_shell_results"]]);
    const service = new TaskService(queue, agreementPoolServiceMock, paymentServiceMock, logger);
    service.run().catch((e) => console.error(e));
    await logger.expectToMatch(/Activity .* created/, 2000);
    expect(task.isFinished()).to.be.true;
    expect(task.getResults()?.stdout).to.equal("some_shell_results");
    await service.end();
  }).timeout(10000);

  // TODO
  it("process only allowed number of tasks");

  // TODO
  it("stop the service if it is interrupted by the user");
});
