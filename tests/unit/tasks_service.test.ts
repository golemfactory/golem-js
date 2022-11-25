import rewiremock from "rewiremock";
import { RequestorControlApiMock } from "../mock/requestor_control_api";
import { RequestorSateApiMock } from "../mock/requestor_state_api";
rewiremock("ya-ts-client/dist/ya-activity/api").with({
  RequestorControlApi: RequestorControlApiMock,
  RequestorStateApi: RequestorSateApiMock,
});
rewiremock.enable();
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Task, TaskQueue, TaskService, Worker } from "../../yajsapi/task";
import { agreementPoolServiceMock, paymentServiceMock, LoggerMock } from "../mock";
chai.use(chaiAsPromised);
const expect = chai.expect;
const queue = new TaskQueue();
const logger = new LoggerMock();

describe("Task Service", () => {
  it("should process new task in queue", async () => {
    const worker: Worker = async (ctx) => ctx.run("some_shell_command");
    const task = new Task(worker);
    queue.addToBegin(task);
    const service = new TaskService(queue, agreementPoolServiceMock, paymentServiceMock, logger);
    await service.run();
    service["activities"]?.[0]["api"]["control"]["setExpectedResult"]([
      ["stdout", "test"], // deploy command
      ["stdout", "test"], // start command
      ["stdout", "some_shell_results"], // run command
    ]);
    expect(task.isFinished()).to.be.true;
    expect(task.getResults()?.[0].stdout).to.equal("some_shell_results");
  });

  // TODO
  it("process only allowed number of tasks");

  // TODO
  it("stop the service if it is interrupted by the user");
});
