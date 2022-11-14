import { expect } from "chai";
import { TaskQueue, TaskNotEligibleError } from "../../yajsapi/task/task_queue";
import TaskMock, { TaskState } from "../mock/task_mock";

describe("#TaskQueue()", function () {
  let test_queue: TaskQueue<TaskMock>;
  beforeEach(function () {
    test_queue = new TaskQueue<TaskMock>();
  });

  it("add() allow to add Task to the queue", () => {
    const task = new TaskMock("taskA", TaskState.New);
    test_queue.addToEnd(task);
    expect(test_queue.size).to.equal(1);
  });

  it("add() throws TaskIsPendingError if adding isPending Task", () => {
    const task = new TaskMock("taskA", TaskState.Pending);
    expect(() => {
      test_queue.addToEnd(task);
    }).to.throw(TaskNotEligibleError);
  });

  it("add() throws TaskIsDoneError if adding isDone Task", () => {
    const task = new TaskMock("taskA", TaskState.Done);
    expect(() => {
      test_queue.addToEnd(task);
    }).to.throw(TaskNotEligibleError);
  });

  it("get() should remove task form the queue", () => {
    const task = new TaskMock("taskA", TaskState.New);
    test_queue.addToEnd(task);
    expect(test_queue.size).to.equal(1);
    test_queue.get();
    expect(test_queue.size).to.equal(0);
  });

  it('get() should return "undefined" when the queue is empty', () => {
    new TaskMock("taskA", TaskState.New);
    expect(test_queue.size).to.equal(0);
    expect(test_queue.get()).to.be.undefined;
  });

  it("add() new Task on the end of the queue", () => {
    const tasksToAdd = ["A", "B", "C"].map((t) => new TaskMock(`task${t}`, TaskState.New));

    // Add tree different tasks to the queue
    tasksToAdd.forEach((task) => test_queue.addToEnd(task));

    // Check if the order is the same
    tasksToAdd.forEach((task) => {
      const returned_task = test_queue.get();
      expect(returned_task).to.deep.equal(task);
    });
  });

  it("add() isRetry Task on the beginning of the queue", () => {
    const tasksToAdd = ["A", "B", "C"].map((t) => new TaskMock(`task${t}`, TaskState.Retry));

    // Add tree different tasks to the queue
    tasksToAdd.forEach((task) => test_queue.addToBegin(task));

    // Reverse expectation and check
    tasksToAdd.reverse().forEach((task) => {
      const returned_task = test_queue.get();
      expect(returned_task).to.deep.equal(task);
    });
  });

  it("size() should return correct number of items in the queue ", () => {
    // Add 3 tasks to the queue
    test_queue.addToEnd(new TaskMock(`task`, TaskState.New));
    test_queue.addToEnd(new TaskMock(`task`, TaskState.New));
    test_queue.addToEnd(new TaskMock(`task`, TaskState.New));

    // Check if is eq 3
    expect(test_queue.size).to.equal(3);

    // Get one
    test_queue.get();

    // Check if is eq 2
    expect(test_queue.size).to.equal(2);

    // Get next two
    test_queue.get();
    test_queue.get();

    // Check if is eq 0
    expect(test_queue.size).to.equal(0);

    // get another one (not existing)
    test_queue.get();

    // Check if still is eq 0
    expect(test_queue.size).to.equal(0);
  });
});
