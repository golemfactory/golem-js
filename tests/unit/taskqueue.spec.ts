import test from "ava";
import Task_queue, { TaskNotEligibleError } from "../../yajsapi/executor/task_queue";
import TaskMock, { TaskState } from "../mock/task_mock"


test('add() allow to add Task to the queue', t => {
    const test_queue = new Task_queue();
    const task = new TaskMock('taskA', TaskState.New);
    test_queue.add(task)
    t.is(test_queue.length(), 1)
})

test('add() throws TaskIsPendingError if adding isPending Task', t => {
    const test_queue = new Task_queue();
    const task = new TaskMock('taskA', TaskState.Pending);
    t.throws(() => {
        test_queue.add(task)
    }, {instanceOf: TaskNotEligibleError});
})

test('add() throws TaskIsDoneError if adding isDone Task', t => {
    const test_queue = new Task_queue();
    const task = new TaskMock('taskA', TaskState.Done);
    t.throws(() => {
        test_queue.add(task)
    }, {instanceOf: TaskNotEligibleError});
})

test('get() should remove task form the queue', t => {
    const test_queue = new Task_queue();
    const task = new TaskMock('taskA', TaskState.New);
    test_queue.add(task)
    t.is(test_queue.length(), 1)
    test_queue.get();
    t.is(test_queue.length(), 0)
});

test('get() should return "undefined" when the queue is empty', t => {
    const test_queue = new Task_queue();
    new TaskMock('taskA', TaskState.New);
    t.is(test_queue.length(), 0)
    t.is(test_queue.get(), undefined);
});

test('add() new Task on the end of the queue', t => {
    const test_queue = new Task_queue();
    const tasksToAdd = ['A', 'B', 'C'].map(t => new TaskMock(`task${t}`, TaskState.New));


    // Add tree different tasks to the queue
    tasksToAdd.forEach(task => test_queue.add(task));

    // Check if the order is the same
    tasksToAdd.forEach(task => {
        const returned_task = test_queue.get();
        t.deepEqual(returned_task, task)
    })
});

test('add() isRetry Task on the beginning of the queue', t => {
    const test_queue = new Task_queue();
    const tasksToAdd = ['A', 'B', 'C'].map(t => new TaskMock(`task${t}`, TaskState.Retry));

    // Add tree different tasks to the queue
    tasksToAdd.forEach(task => test_queue.add(task));

    // Reverse expectation and check
    tasksToAdd.reverse().forEach(task => {
        const returned_task = test_queue.get();
        t.deepEqual(returned_task, task)
    })
});


test('length() should return correct number of items in the queue ', t => {
    const test_queue = new Task_queue();

    // Add 3 tasks to the queue
    test_queue.add(new TaskMock(`task`, TaskState.New))
    test_queue.add(new TaskMock(`task`, TaskState.New))
    test_queue.add(new TaskMock(`task`, TaskState.New))

    // Check if is eq 3
    t.is(test_queue.length(), 3);

    // Get one
    test_queue.get()

    // Check if is eq 2
    t.is(test_queue.length(), 2);

    // Get next two
    test_queue.get()
    test_queue.get()

    // Check if is eq 0
    t.is(test_queue.length(), 0);

    // get another one (not existing)
    test_queue.get()

    // Check if still is eq 0
    t.is(test_queue.length(), 0);
});
