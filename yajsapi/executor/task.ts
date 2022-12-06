import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { Callable, eventLoop } from "../utils";
import * as events from "./events";
import { Handle, SmartQueue } from "./smartq";

dayjs.extend(utc);

export enum TaskStatus {
  WAITING = "wait",
  RUNNING = "run",
  ACCEPTED = "accept",
  REJECTED = "reject",
}

type TaskData = "TaskData";
type TaskResult = "TaskResult";
type TaskEvents = events.TaskAccepted | events.TaskRejected;

/**
 * One computation unit.
 *
 * @description Represents one computation unit that will be run on the provider (e.g. rendering of one frame of an animation).
 */
export class Task<TaskData, TaskResult> {
  static count = 0;
  public id = 0;
  private _started: number | null;
  private _finished: number | null;
  private _emit_event: any;
  private _callbacks!: Set<(...args) => void | null>;
  private _handle?: [Handle<Task<TaskData, TaskResult>>, SmartQueue<Task<TaskData, TaskResult>>];
  private _result?: TaskResult | null;
  private _data;
  private _worker;
  private _status!: TaskStatus;

  /**
   * Create a new Task object.
   *
   * @param data     contains information needed to prepare command list for the provider
   */
  constructor(data: TaskData, worker) {
    this.id = Task.counter;
    this._started = null;
    this._finished = null;
    this._emit_event = null;
    this._callbacks = new Set();

    this._result = null;
    this._data = data;
    this._worker = worker;
    this._status = TaskStatus.WAITING;
  }

  _add_callback(callback: (...args) => void): void {
    this._callbacks.add(callback);
  }

  _start(_emitter): void {
    this._status = TaskStatus.RUNNING;
    this._emit_event = _emitter;
    this._started = dayjs.utc().unix();
    this._finished = null;
  }

  _stop(retry = false): void {
    this._finished = dayjs.utc().unix();
    if (this._handle) {
      const [handle, queue] = this._handle;
      const loop = eventLoop();
      if (retry) loop.create_task(queue.reschedule.bind(queue, handle));
      else loop.create_task(queue.mark_done.bind(queue, handle));
    }
  }

  static for_handle(
    handle: Handle<Task<any, any>>,
    queue: SmartQueue<Task<any, any>>,
    emitter: Callable<[events.YaEvent], void>
  ): Task<"D", "R"> {
    const task = handle.data();
    task._handle = [handle, queue];
    task._start(emitter);
    return task;
  }

  status(): TaskStatus {
    return this._status;
  }

  data(): TaskData {
    return this._data;
  }

  worker() {
    return this._worker;
  }

  result(): TaskResult | null | undefined {
    return this._result;
  }

  running_time(): number | null {
    if (this._finished) {
      if (!this._started) throw Error("Task._started is null");
      return this._finished - this._started;
    }
    if (this._started) {
      return dayjs.utc().unix() - this._started;
    }
    return null;
  }

  /**
   * Accept the result of this task.
   *
   * @description Must be called when the result is correct to mark this task as completed.
   * @param result task computation result (optional)
   */
  accept_result(result: TaskResult | null = null): void {
    if (this._emit_event) {
      this._emit_event(new events.TaskAccepted({ task_id: this.id, result }));
    }
    if (this._status != TaskStatus.RUNNING) throw "Accepted task not running. STATUS: " + this._status;
    this._status = TaskStatus.ACCEPTED;
    this._stop();
    this._result = result;
    for (const cb of this._callbacks) cb && cb(this, TaskStatus.ACCEPTED);
  }

  /**
   * Reject the result of this task.
   *
   * @description Must be called when the result is not correct to indicate that the task should be retried.
   *
   * @param reason  Task rejection description (optional)
   * @param retry   Task retry in case of rejects (optional)
   */
  reject_result(reason: string | null = null, retry = false): void {
    if (this._emit_event) {
      this._emit_event(new events.TaskRejected({ task_id: this.id, reason }));
    }
    if (this._status != TaskStatus.RUNNING) throw "Rejected task not running";
    this._status = TaskStatus.REJECTED;
    this._stop(retry);

    for (const cb of this._callbacks) cb && cb(this, TaskStatus.REJECTED);
  }

  static get counter(): number {
    Task.count = (Task.count || 0) + 1;
    return Task.count;
  }
}
