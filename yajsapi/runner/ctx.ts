import { StorageProvider, Source, Destination } from "../storage";
import { logger } from "../utils";

export class CommandContainer {
  private _commands;

  constructor() {
    this._commands = [];
    return new Proxy(this, this.getattr());
  }

  commands() {
    return this._commands;
  }

  getattr() {
    const self = this;
    return {
      get(target, name) {
        if (target[name] !== undefined) {
          return target[name];
        }
        const newFunction = function () {
          let _arguments = {};
          let args = arguments[0] || {};
          for (const [key, value] of Object.entries(args)) {
            _arguments = {
              ..._arguments,
              [key.startsWith("_") ? key.slice(1) : key]: value,
            };
          }
          let idx = self._commands.length;
          self._commands.push({ [name]: _arguments });
          return idx;
        };
        return new Proxy(newFunction, {
          apply: function (target, thisArg, argumentsList) {
            return target.apply(thisArg, argumentsList);
          },
        });
      },
    };
  }
}

export class Work {
  async prepare() {
    // Executes before commands are send to provider.
  }

  register(commands: CommandContainer) {}

  async post() {}
}

class _InitStep extends Work {
  register(commands: any) {
    //CommandContainer
    commands.deploy();
    commands.start();
  }
}

class _SendWork extends Work {
  private _storage;
  private _dst_path;
  private _src?: Source | null;
  private _idx: Number | null;

  constructor(storage: StorageProvider, dst_path: string) {
    super();
    this._storage = storage;
    this._dst_path = dst_path;
    this._src = null;
    this._idx = null;
  }

  async do_upload(storage: StorageProvider): Promise<Source> {
    return new Promise((resolve) => resolve(new Source())); //TODO check this
  }

  async prepare(): Promise<void> {
    this._src = await this.do_upload(this._storage);
  }

  register(commands: any) {
    //CommandContainer
    if (!this._src) throw "cmd prepared";
    this._idx = commands.transfer({
      _from: this._src.download_url(),
      _to: `container:${this._dst_path}`,
    });
  }
}

class _SendJson extends _SendWork {
  private _cnt: number;
  private _data: Buffer | null;

  constructor(storage: StorageProvider, data: {}, dst_path: string) {
    super(storage, dst_path);
    this._cnt = 0;
    this._data = Buffer.from(JSON.stringify(data), "utf-8"); //Optional[bytes]
  }

  async do_upload(storage: StorageProvider): Promise<Source> {
    this._cnt += 1;
    if (!this._data) throw `json buffer unintialized ${this._cnt}`;
    let src = await storage.upload_bytes(this._data);
    this._data = null;
    return src;
  }
}

class _SendFile extends _SendWork {
  private _src_path: string;

  constructor(storage: StorageProvider, src_path: string, dst_path: string) {
    super(storage, dst_path);
    this._src_path = src_path;
  }

  async do_upload(storage: StorageProvider): Promise<Source> {
    return await storage.upload_file(this._src_path);
  }
}

class _Run extends Work {
  private cmd;
  private args;
  private env;
  private _idx;

  constructor(cmd: string, args: Iterable<string> = [], env: {} | null = null) {
    super();
    this.cmd = cmd;
    this.args = args;
    this.env = env;
    this._idx = null;
  }

  register(commands: any) {
    //CommandContainer
    this._idx = commands.run({
      entry_point: this.cmd,
      args: this.args || [],
    });
  }
}

class _RecvFile extends Work {
  private _storage;
  private _dst_path;
  private _src_path!: string;
  private _idx: number | null;
  private _dst_slot: Destination | null;

  constructor(storage: StorageProvider, src_path: string, dst_path: string) {
    super();
    this._storage = storage;
    this._dst_path = dst_path;
    this._src_path = src_path;
    this._idx = null;
    this._dst_slot = null;
  }

  async prepare() {
    this._dst_slot = await this._storage.new_destination(this._dst_path);
  }

  register(commands: any) {
    //CommandContainer
    if (!this._dst_slot) throw "_RecvFile command creation without prepare";
    this._idx = commands.transfer({
      _from: `container:${this._src_path}`,
      _to: this._dst_slot!.upload_url(),
    });
  }

  async post() {
    if (!this._dst_slot) throw "_RecvFile post without prepare";
    logger.log("debug", `download is started: ${this._dst_path}`);
    await this._dst_slot.download_file(this._dst_path);
    logger.info(`download is done: ${this._dst_path}`);
  }
}

class _Steps extends Work {
  private _steps: Work[] = [];

  constructor(steps: Work | Work[]) {
    super();
    if (steps instanceof Work) this._steps.push(steps);
    else steps.forEach((step) => this._steps.push(step));
  }

  async prepare() {
    for (let step of this._steps) {
      await step.prepare();
    }
  }

  register(commands: CommandContainer) {
    for (let step of this._steps) {
      step.register(commands);
    }
  }

  async post() {
    for (let step of this._steps) {
      await step.post();
    }
  }
}

export class WorkContext {
  private _id;
  private _storage: StorageProvider;
  private _pending_steps: Work[];
  private _started: boolean;

  constructor(ctx_id: string, storage: StorageProvider) {
    this._id = ctx_id;
    this._storage = storage;
    this._pending_steps = [];
    this._started = false;
  }
  _prepare() {
    if (!this._started) {
      this._pending_steps.push(new _InitStep());
      this._started = true;
    }
  }
  begin() {}
  send_json(json_path: string, data: {}) {
    this._prepare();
    this._pending_steps.push(new _SendJson(this._storage, data, json_path));
  }
  send_file(src_path: string, dst_path: string) {
    this._prepare();
    this._pending_steps.push(new _SendFile(this._storage, src_path, dst_path));
  }
  run(cmd: string, args?: Iterable<string>, env: object | null = null) {
    this._prepare();
    this._pending_steps.push(new _Run(cmd, args, env));
  }
  download_file(src_path: string, dst_path: string) {
    this._prepare();
    this._pending_steps.push(new _RecvFile(this._storage, src_path, dst_path));
  }
  log(args) {
    console.log(`W${this._id}: `, args);
  }

  commit(): Work {
    let steps = this._pending_steps;
    this._pending_steps = [];
    return new _Steps(steps);
  }
}
