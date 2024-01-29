import * as activityMock from "../mock/rest/activity";
import { Task, TaskQueue, TaskService, WorkContext, Worker } from "../../src/task";
import { agreementPoolServiceMock, paymentServiceMock, networkServiceMock, LoggerMock, YagnaMock } from "../mock";

let queue: TaskQueue;
const logger = new LoggerMock();

describe("Task Service", () => {
  beforeEach(() => {
    logger.clear();
    activityMock.clear();
    queue = new TaskQueue();
  });
  it("should process new task in queue", async () => {
    const worker = async (ctx: WorkContext) => ctx.run("some_shell_command");
    const task = new Task("1", worker);
    queue.addToEnd(task);
    activityMock.setExpectedExeResults([{ stdout: "some_shell_results" }]);
    const service = new TaskService(
      new YagnaMock().getApi(),
      queue,
      agreementPoolServiceMock,
      paymentServiceMock,
      networkServiceMock,
      {
        logger,
        taskRunningInterval: 10,
        activityStateCheckingInterval: 10,
      },
    );
    service.run().catch((e) => console.error(e));
    await logger.expectToInclude("Activity created", { id: expect.anything() }, 500);
    expect(task.isFinished()).toEqual(true);
    expect(task.getResults()?.stdout).toEqual("some_shell_results");
    await service.end();
    await logger.expectToInclude("Activity destroyed", { id: expect.anything() }, 1);
    await logger.expectToInclude("Task Service has been stopped", undefined, 1);
  });

  it("process only allowed number of tasks simultaneously", async () => {
    const worker = async (ctx: WorkContext) => ctx.run("some_shell_command");
    const task1 = new Task("1", worker);
    const task2 = new Task("2", worker);
    const task3 = new Task("3", worker);
    queue.addToEnd(task1);
    queue.addToEnd(task2);
    queue.addToEnd(task3);
    const service = new TaskService(
      new YagnaMock().getApi(),
      queue,
      agreementPoolServiceMock,
      paymentServiceMock,
      networkServiceMock,
      {
        logger,
        maxParallelTasks: 2,
      },
    );
    service.run().catch((e) => console.error(e));
    expect(task1.isPending()).toEqual(true);
    expect(task2.isPending()).toEqual(true);
    expect(task3.isPending()).toEqual(false);
    expect(task3.isNew()).toEqual(true);
    await service.end();
  });

  it("should retry task if it failed", async () => {
    const worker = async (ctx: WorkContext) => ctx.run("some_shell_command");
    const task = new Task("1", worker);
    queue.addToEnd(task);
    activityMock.setExpectedErrors([new Error(), new Error(), new Error(), new Error(), new Error()]);
    const service = new TaskService(
      new YagnaMock().getApi(),
      queue,
      agreementPoolServiceMock,
      paymentServiceMock,
      networkServiceMock,
      {
        logger,
        taskRunningInterval: 100,
        activityStateCheckingInterval: 100,
      },
    );
    service.run().catch((e) => console.error(e));
    await logger.expectToInclude(
      "Task execution failed. Trying to redo the task.",
      {
        taskId: task.id,
        attempt: 1,
        reason: expect.anything(),
      },
      700,
    );
    await service.end();
  });

  it("should not retry task if it failed and maxRetries is zero", async () => {
    const worker = async (ctx: WorkContext) => ctx.run("some_shell_command");
    const task = new Task("1", worker, { maxRetries: 0 });
    queue.addToEnd(task);
    activityMock.setExpectedErrors([new Error(), new Error(), new Error(), new Error(), new Error()]);
    const service = new TaskService(
      new YagnaMock().getApi(),
      queue,
      agreementPoolServiceMock,
      paymentServiceMock,
      networkServiceMock,
      {
        logger,
        taskRunningInterval: 100,
        activityStateCheckingInterval: 100,
      },
    );
    service.run().catch((e) => console.error(e));
    await logger.expectToNotMatch(/Trying to redo the task/, 100);
    await logger.expectToInclude("Task has been rejected", { taskId: task.id, reason: expect.anything() }, 100);
    await service.end();
  });

  it("should throw an error if maxRetries is less then zero", async () => {
    const worker = async (ctx: WorkContext) => Promise.resolve(true);
    expect(() => new Task("1", worker, { maxRetries: -1 })).toThrow(
      "The maxRetries parameter cannot be less than zero",
    );
  });

  it("should reject task if it failed max attempts", async () => {
    const worker = async (ctx: WorkContext) => ctx.run("some_shell_command");
    const task = new Task("1", worker, { maxRetries: 1 });
    queue.addToEnd(task);
    activityMock.setExpectedErrors(new Array(20).fill(new Error()));
    const service = new TaskService(
      new YagnaMock().getApi(),
      queue,
      agreementPoolServiceMock,
      paymentServiceMock,
      networkServiceMock,
      {
        logger,
        taskRunningInterval: 10,
        activityStateCheckingInterval: 10,
      },
    );
    service.run().catch((e) => console.error(e));
    await logger.expectToInclude(
      "Task has been rejected",
      {
        taskId: task.id,
        reason: expect.anything(),
      },
      1800,
    );
    expect(task.isRejected()).toEqual(true);
    await service.end();
  });

  it("should run setup functions on each activity", async () => {
    const setupFunctions = [async (ctx: WorkContext) => ctx.run("init_shell_command")];
    const worker = async (ctx: WorkContext) => ctx.run("some_shell_command");
    const task1 = new Task("1", worker, { activityReadySetupFunctions: setupFunctions });
    const task2 = new Task("2", worker, { activityReadySetupFunctions: setupFunctions });
    const task3 = new Task("3", worker, { activityReadySetupFunctions: setupFunctions });
    queue.addToEnd(task1);
    queue.addToEnd(task2);
    queue.addToEnd(task3);
    const service = new TaskService(
      new YagnaMock().getApi(),
      queue,
      agreementPoolServiceMock,
      paymentServiceMock,
      networkServiceMock,
      {
        logger,
        taskRunningInterval: 10,
        activityStateCheckingInterval: 10,
        maxParallelTasks: 2,
      },
    );
    service.run().catch((e) => console.error(e));

    await new Promise((res) => setTimeout(res, 1000));

    const setupsCompleted = logger.logs.split("\n").filter((log) => log.includes("Activity setup completed")).length;
    expect(setupsCompleted).toEqual(2);

    expect(task1.isFinished()).toEqual(true);
    expect(task2.isFinished()).toEqual(true);
    expect(task3.isFinished()).toEqual(true);
    await service.end();
  });
});
