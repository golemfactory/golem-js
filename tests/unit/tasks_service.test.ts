import * as activityMock from "../mock/rest/activity";
import { Task, TaskQueue, TaskService, Worker } from "../../src/task";
import { agreementPoolServiceMock, paymentServiceMock, networkServiceMock, LoggerMock, YagnaMock } from "../mock";
import { Result } from "../../src";
let queue;
const logger = new LoggerMock();

describe("Task Service", () => {
  beforeEach(() => {
    logger.clear();
    activityMock.clear();
    queue = new TaskQueue<Task<any, any>>();
  });
  it("should process new task in queue", async () => {
    const worker: Worker<null, Result> = async (ctx) => ctx.run("some_shell_command");
    const task = new Task<null, Result>("1", worker);
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
    await logger.expectToMatch(/Activity .* created/, 500);
    expect(task.isFinished()).toEqual(true);
    expect(task.getResults()?.stdout).toEqual("some_shell_results");
    await service.end();
    await logger.expectToMatch(/Activity .* destroyed/, 1);
    await logger.expectToInclude("Task Service has been stopped", 1);
  });

  it("process only allowed number of tasks simultaneously", async () => {
    const worker: Worker = async (ctx) => ctx.run("some_shell_command");
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
    const worker: Worker = async (ctx) => ctx.run("some_shell_command");
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
    await logger.expectToInclude("Task 1 execution failed. Trying to redo the task. Attempt #", 700);
    await service.end();
  });

  it("should reject task by user", async () => {
    const worker: Worker = async (ctx) => {
      const result = await ctx.run("some_shell_command");
      if (result.stdout === "invalid_value") ctx.rejectResult("Invalid value computed by provider");
    };
    const task = new Task("1", worker, undefined, undefined, { maxRetries: 2 });
    queue.addToEnd(task);
    activityMock.setExpectedExeResults([{ result: "Ok", stdout: "invalid_value" }]);
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
      "Error: Task 1 has been rejected! Work rejected. Reason: Invalid value computed by provider",
      1500,
    );
    expect(task.isFinished()).toEqual(true);
    await service.end();
  });

  it("should reject task if it failed max attempts", async () => {
    const worker: Worker = async (ctx) => ctx.run("some_shell_command");
    const task = new Task("1", worker, undefined, undefined, 1);
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
    await logger.expectToInclude("Error: Task 1 has been rejected!", 1800);
    expect(task.isRejected()).toEqual(true);
    await service.end();
  });

  it("should run init worker on each activity", async () => {
    const initWorker: Worker = async (ctx) => ctx.run("init_shell_command");
    const worker: Worker = async (ctx) => ctx.run("some_shell_command");
    const task1 = new Task("1", worker, null, initWorker);
    const task2 = new Task("2", worker, null, initWorker);
    const task3 = new Task("3", worker, null, initWorker);
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
    await logger.expectToMatch(/Init worker done in activity((.|\n)*)Init worker done in activity/, 700);
    await logger.expectToNotMatch(
      /Init worker done in activity.*\nInit worker done in activity((.|\n)*)Init worker done in activity/,
    );
    await new Promise((res) => setTimeout(res, 1000));
    expect(task1.isFinished()).toEqual(true);
    expect(task2.isFinished()).toEqual(true);
    expect(task3.isFinished()).toEqual(true);
    await service.end();
  });
});
