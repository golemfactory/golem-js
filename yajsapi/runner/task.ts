import { Callable, eventLoop } from "../utils";
import * as events from "./events";
import { Handle, SmartQueue } from "./smartq";

export enum TaskStatus {
  WAITING = "wait",
  RUNNING = "run",
  ACCEPTED = "accept",
  REJECTED = "reject",
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

  _add_callback(callback: Function): void {
    this._callbacks.add(callback);
  }

  _start(_emitter): void {
    this._status = TaskStatus.RUNNING;
    this._emit_event = _emitter;
  }

  _stop(retry: boolean = false): void {
    if (this._handle) {
      const [handle, queue] = this._handle;
      let loop = eventLoop();
      if (retry) loop.create_task(queue.reschedule.bind(queue, handle));
      else loop.create_task(queue.mark_done.bind(queue, handle));
    }
  }

  static for_handle(
    handle: Handle<Task<any, any>>,
    queue: SmartQueue<Task<any, any>>,
    emitter: Callable<[events.YaEvent], void>
  ): Task<"TaskData", "TaskResult"> {
    let task = handle.data();
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

  output(): TaskResult | null | undefined {
    return this._result;
  }

  expires(): number | null {
    return this._expires;
  }

  accept_task(result: TaskResult | null = null): void {
    if (this._emit_event) {
      this._emit_event(new events.TaskAccepted({task_id: this.id, result}));
    }
    if (this._status != TaskStatus.RUNNING) throw "Accepted task not running";
    this._status = TaskStatus.ACCEPTED;
    this._result = result;
    this._stop();
    for (let cb of this._callbacks) cb && cb(this, TaskStatus.ACCEPTED);
  }

  reject_task(reason: string | null = null, retry: boolean = false): void {
    if (this._emit_event) {
      this._emit_event(new events.TaskRejected({task_id: this.id, reason}));
    }
    if (this._status != TaskStatus.RUNNING) throw "Rejected task not running";
    this._status = TaskStatus.REJECTED;
    this._stop(retry)

    for (let cb of this._callbacks) cb && cb(self, TaskStatus.REJECTED)
  }

  static get counter(): number {
    Task.count = (Task.count || 0) + 1;
    return Task.count;
  }
}
