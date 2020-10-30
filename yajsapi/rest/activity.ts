import {
  RequestorControlApi,
  RequestorStateApi,
} from "ya-ts-client/dist/ya-activity/api";
import * as yaa from "ya-ts-client/dist/ya-activity/src/models";
import { sleep } from "../utils";
import { Configuration } from "ya-ts-client/dist/ya-activity";
import { logger } from "../utils";

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

  async send(script: object[]) {
    let script_txt = JSON.stringify(script);
    let _script_request: yaa.ExeScriptRequest = new ExeScriptRequest(
      script_txt
    );
    let { data: batch_id } = await this._api.exec(this._id, _script_request);
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

class Result {
  idx!: Number;
  message?: string;
}

class CommandExecutionError extends Error {
  constructor(key: string, description: string) {
    super(description);
    this.name = key;
  }
}

class Batch implements AsyncIterable<Result> {
  private _api!: RequestorControlApi;
  private _activity_id!: string;
  private _batch_id!: string;
  private _size;

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
  return(value: any): Promise<IteratorResult<Result, any>> {
    throw new Error("Method not implemented.");
  }
  throw(e: any): Promise<IteratorResult<Result, any>> {
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
            result.message || ""
          );
        let _result = new Result();
        _result.idx = result.index;
        _result.message = result.message;
        yield _result;
        last_idx = result.index + 1;
        if (result.isBatchFinished) break;
        if (!any_new) await sleep(10);
      }
    }
    return;
  }
}
