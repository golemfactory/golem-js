import {
  RequestorControlApi,
  RequestorStateApi,
} from "ya-ts-client/dist/ya-activity/api";
import * as yaa from "ya-ts-client/dist/ya-activity/src/models";
import { sleep } from "../utils";
import { Configuration } from "ya-ts-client/dist/ya-activity";
import { logger } from "../utils";
import { BaseAPI } from "ya-ts-client/dist/ya-activity/base";
import {
  CommandEvent,
  CommandEventContext,
  CommandExecuted,
  CommandStarted,
  CommandStdErr,
  CommandStdOut
} from "../runner/events";
import ServerEventSource from "eventsource";

export class ActivityService {
  private _api;
  private _state;

  constructor(cfg: Configuration) {
    this._api = new RequestorControlApi(cfg);
    this._state = new RequestorStateApi(cfg);
  }

  async new_activity(agreement_id: string): Promise<Activity> {
    try {
      let { data: activity_id } = await this._api.createActivity(agreement_id);
      let _activity = new Activity(this._api);
      _activity.state = this._state;
      _activity.id = activity_id;
      return _activity;
    } catch (error) {
      logger.error(`Failed to create activity for agreement ${agreement_id}`);
      throw error;
    }
  }
}

class ExeScriptRequest implements yaa.ExeScriptRequest {
  text!: string;
  constructor(text) {
    this.text = text;
  }
}

export class Activity {
  private _api!: RequestorControlApi;
  private _state!: RequestorStateApi;
  private _id!: string;

  constructor(_api: RequestorControlApi) {
    this._api = _api;
  }

  set id(x) {
    this._id = x;
  }

  get id(): string {
    return this._id;
  }

  async state(): Promise<yaa.ActivityState> {
    let { data: result } = await this._state.getActivityState(this._id);
    let state: yaa.ActivityState = result;
    return state;
  }

  async send(script: object[], stream: boolean = false) {
    let script_txt = JSON.stringify(script);
    let _script_request: yaa.ExeScriptRequest = new ExeScriptRequest(
      script_txt
    );
    let { data: batch_id } = await this._api.exec(this._id, _script_request);

    // FIXME
    if (!stream) {
      return new StreamingBatch(this._api, this._id, batch_id, script.length);
    }
    return new Batch(this._api, this._id, batch_id, script.length);
  }

  async ready(): Promise<Activity> {
    return this;
  }

  async done(): Promise<void> {
    try {
      const { data: batch_id } = await this._api.exec(
        this._id,
        new ExeScriptRequest('[{"terminate":{}}]')
      );
      //with contextlib.suppress(yexc.ApiException):
      await this._api.getExecBatchResults(this._id, batch_id, 1);
    } catch (error) {
      logger.error(`failed to destroy activity: ${this._id}`);
    }
    await this._api.destroyActivity(this._id);
  }
}
class CommandExecutionError extends Error {
  constructor(key: string, description: string) {
    super(description);
    this.name = key;
  }
}

class Batch implements AsyncIterable<CommandEventContext> {
  protected _api!: RequestorControlApi;
  protected _activity_id!: string;
  protected _batch_id!: string;
  protected _size;

  constructor(
    _api: RequestorControlApi,
    activity_id: string,
    batch_id: string,
    batch_size: number
  ) {
    this._api = _api;
    this._activity_id = activity_id;
    this._batch_id = batch_id;
    this._size = batch_size;
  }
  return(value: any): Promise<IteratorResult<CommandEventContext, any>> {
    throw new Error("Method not implemented.");
  }
  throw(e: any): Promise<IteratorResult<CommandEventContext, any>> {
    throw new Error("Method not implemented.");
  }

  id() {
    this._batch_id;
  }

  async *[Symbol.asyncIterator](): any {
    // AsyncGenerator<Result, any, unknown>
    let last_idx = 0;
    while (last_idx < this._size) {
      let any_new: boolean = false;
      let { data: exe_list } = await this._api.getExecBatchResults(
        this._activity_id,
        this._batch_id,
        undefined,
        30 //timeout 30s
      );
      let results: yaa.ExeScriptCommandResult[] = exe_list;
      results = results.slice(last_idx);
      for (let result of results) {
        any_new = true;
        if (last_idx != result.index)
          throw `Expected ${last_idx}, got ${result.index}`;
        if (result.result.toString() == "Error")
          throw new CommandExecutionError(
            last_idx.toString(),
            JSON.stringify(result)
          );

        let evt = Object.create(CommandExecuted.prototype);
        evt.cmd_idx = result.index;
        evt.success = true;
        evt.message = JSON.stringify({
          stdout: result.stdout,
          stderr: result.stderr,
          message: result.message,
        });
        yield new CommandEventContext(evt);

        last_idx = result.index + 1;
        if (result.isBatchFinished) break;
        if (!any_new) await sleep(10);
      }
    }
    return;
  }
}

class StreamingBatch extends Batch {
  async *[Symbol.asyncIterator](): any {
    let config_prov = new ApiConfigProvider(this._api);
    let host = config_prov.base_path();
    let api_key = await config_prov.api_key();

    let event_source = new ServerEventSource(
      `${host}/activity/${this._activity_id}/exec/${this._batch_id}`,
      {
        headers: {
          "Accept": "text/event-stream",
          "Authorization": api_key ? `Bearer ${api_key}`: undefined,
        }
      }
    );

    let last_idx = this._size - 1;
    let results: CommandEventContext[] = [];
    let finished = false;

    let resolve: () => void;
    let promise = new Promise(r => resolve = r);

    const on_error = (e: object) => {
      if (!e) return;
      let msg = !e["message"]
        ? "source unavailable"
        : e["message"];
      logger.error("Runtime event source error:", msg);
      cleanup();
    };
    const on_event = (e: object) => {
      try {
        results.push(CommandEventContext.fromJson(e["data"]));
        resolve();
        promise = new Promise(r => resolve = r);
      } catch (e) {
        logger.warn("Runtime event error:", e);
      }
    };
    const cleanup = () => {
      event_source.removeEventListener('error', on_error);
      event_source.removeEventListener('runtime', on_event);
      event_source.close();

      finished = true;
      resolve();
    };

    event_source.addEventListener('error', on_error);
    event_source.addEventListener('runtime', on_event);

    while (!finished) {
      await promise;

      for (let result of results) {
        yield result;

        if (result.computation_finished(last_idx)) {
          finished = true;
          break;
        }
      }
      results = [];
    }

    cleanup();
  }
}

export class ApiConfigProvider extends BaseAPI {
  constructor(api: BaseAPI) {
    let as_this: ApiConfigProvider = <ApiConfigProvider> api;
    super(as_this.configuration, as_this.basePath, as_this.axios);
  }

  base_path(): string {
    return (this.configuration && this.configuration.basePath)
      ? this.configuration.basePath
      : "";
  }

  async api_key(): Promise<string | undefined> {
    let api_key = this.configuration
      ? this.configuration.apiKey
      : undefined;
    if (typeof api_key === "string") {
      return api_key;
    }
    return undefined;
  }
}
