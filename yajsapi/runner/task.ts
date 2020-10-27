import { Callable, eventLoop } from "../utils";
import * as events from "./events";
import { Handle, SmartQueue } from "./smartq";

export enum TaskStatus {
  WAITING = "WAITING",
  RUNNING = "RUNNING",
  ACCEPTED = "ACCEPTED",
  REJECTED = "REJECTED",
}

type TaskData = "TaskData";
type TaskResult = "TaskResult";
type TaskEvents = events.TaskAccepted | events.TaskRejected;

export class Task<TaskData, TaskResult> {
  static count: number = 0;
  public id: number = 0;
  private _started: number;
  private _expires: number | null;
  private _emit_event: any;
  private _callbacks!: Set<Function | null>;
  private _handle?: [
    Handle<Task<TaskData, TaskResult>>,
    SmartQueue<Task<TaskData, TaskResult>>
  ];
  private _result?: TaskResult | null;
  private _data;
  private _status!: TaskStatus;
  constructor(
    data: TaskData,
    expires: number | null = null,
    timeout: number | null = null
  ) {
    this.id = Task.counter;
    this._started = Date.now();
    this._emit_event = null;
    this._callbacks = new Set();
    if (timeout) this._expires = this._started + timeout;
    else this._expires = expires;

    this._result = null;
    this._data = data;
    this._status = TaskStatus.WAITING;
  }

  _add_callback(callback) {
    this._callbacks.add(callback);
  }

  _start(_emitter) {
    this._status = TaskStatus.RUNNING;
    this._emit_event = _emitter;
  }

  _stop(retry: boolean = false) {
    if (this._handle) {
      const [handle, queue] = this._handle;
      let loop = eventLoop();
      if (retry) loop.create_task(queue.reschedule(handle));
      else loop.create_task(queue.mark_done(handle));
    }
  }

  static for_handle(
    handle: Handle<Task<any, any>>,
    queue: SmartQueue<Task<any, any>>,
    emitter: Callable<[events.YaEvent], void>
  ): any {
    //Task<TaskData, TaskResult>
    let task = handle.data();
    task._handle = [handle, queue];
    task._start(emitter);
    return task;
  }

  status() {
    return this._status;
  }

  data(): TaskData {
    return this._data;
  }

  output(): TaskResult | null | undefined {
    return this._result;
  }

  expires() {
    return this._expires;
  }

  accept_task(result: TaskResult | null = null) {
    if (this._emit_event) {
      this._emit_event("task", "accept", null, result);
    }
    if (this._status != TaskStatus.RUNNING) throw "";
    this._status = TaskStatus.ACCEPTED;
    for (let cb of this._callbacks) cb && cb(this, "accept");
  }

  reject_task() {
    if (this._status != TaskStatus.RUNNING) throw "";
    this._status = TaskStatus.REJECTED;
  }

  static get counter() {
    Task.count = (Task.count || 0) + 1;
    return Task.count;
  }
}
