import {
  RequestorControlApi,
  RequestorStateApi,
} from "ya-ts-client/dist/ya-activity/api";
import * as yaa from "ya-ts-client/dist/ya-activity/src/models";
import { sleep } from "../utils";
import { Configuration } from "ya-ts-client/dist/ya-activity";
import { Credentials, ExeScriptCommandResult, SgxCredentials } from "ya-ts-client/dist/ya-activity/src/models";
import { CryptoCtx, PrivateKey, PublicKey, rand_hex } from "../crypto";
import { logger } from "../utils";
import { Agreement } from "./market";
import { SGX_CONFIG } from "../runner/sgx";

export class ActivityService {
  private _api!: RequestorControlApi;
  private _state!: RequestorStateApi;

  constructor(cfg: Configuration) {
    this._api = new RequestorControlApi(cfg);
    this._state = new RequestorStateApi(cfg);
  }

  async create_activity(agreement: Agreement, secure: boolean = false): Promise<Activity> {
    try {
      if (secure) {
        return await this._create_secure_activity(agreement);
      } else {
        return await this._create_activity(agreement.id());
      }
    } catch (error) {
      logger.error(`Failed to create activity for agreement ${agreement.id()}`);
      throw error;
    }
  }

  async _create_secure_activity(agreement: Agreement): Promise<SecureActivity> {
    let priv_key = new PrivateKey();
    let pub_key = priv_key.publicKey();
    let crypto_ctx: CryptoCtx;

    let {
      data: {
        activityId: activity_id,
        credentials: credentials,
      }
    } = await this._api.createActivity({
      agreementId: agreement.id(),
      requestorPubKey: pub_key.toString(),
    });

    try {
      if (!credentials) {
        throw Error("Missing credentials in CreateActivity response");
      }
      if (pub_key.toString() != credentials.sgx.requestorPubKey) {
        throw Error("Invalid requestor public key in CreateActivity response");
      }

      let enclave_key = PublicKey.fromHex(credentials.sgx.enclavePubKey);
      crypto_ctx = await CryptoCtx.from(enclave_key, priv_key);
      await this._attest(pub_key, credentials);

    } catch (error) {
      await this._api.destroyActivity(activity_id);
      throw error;
    }

    return new SecureActivity(activity_id, crypto_ctx, this._api, this._state);
  }

  async _attest(_pub_key: PublicKey, _credentials?: Credentials) {
    if (!!SGX_CONFIG.enableAttestation) {
      // TODO: call attestation API

      if (!SGX_CONFIG.allowDebug) {
        // ..
      }
      if (!SGX_CONFIG.allowOutdatedTcb) {
        // ..
      }
    }
  }

  async _create_activity(agreement_id: string): Promise<Activity> {
    let { data: { activityId: activity_id } } = await this._api.createActivity(agreement_id);
    return new Activity(activity_id, this._api, this._state);
  }
}

class ExeScriptRequest implements yaa.ExeScriptRequest {
  text!: string;
  constructor(text: string) {
    this.text = text;
  }
}

class Activity {
  protected _api!: RequestorControlApi;
  protected _state!: RequestorStateApi;
  protected _id!: string;

  constructor(id: string, _api: RequestorControlApi, _state: RequestorStateApi) {
    this._id = id;
    this._api = _api;
    this._state = _state;
  }

  set id(x) {
    this._id = x;
  }

  get id(): string {
    return this._id;
  }

  async exec(script: object[]) {
    let script_txt = JSON.stringify(script);
    let req: yaa.ExeScriptRequest = new ExeScriptRequest(script_txt);
    let { data: batch_id } = await this._api.exec(this._id, req);
    return new Batch(this, batch_id, script.length);
  }

  async state(): Promise<yaa.ActivityState> {
    let { data: result } = await this._state.getActivityState(this._id);
    let state: yaa.ActivityState = result;
    return state;
  }

  async results(batch_id: string, timeout: number = 30): Promise<ExeScriptCommandResult[]> {
    let { data: results } = await this._api.getExecBatchResults(
      this._id,
      batch_id,
      undefined,
      timeout,
    );
    return results;
  }

  async ready(): Promise<Activity> {
    return this;
  }

  async done(): Promise<void> {
    await this._api.destroyActivity(this._id);
  }
}

class SecureActivity extends Activity {
  _crypto_ctx!: CryptoCtx;

  constructor(
    id: string,
    crypto_ctx: CryptoCtx,
    _api: RequestorControlApi,
    _state: RequestorStateApi
  ) {
    super(id, _api, _state);
    this._crypto_ctx = crypto_ctx;
  }

  async exec(script: object[]) {
    let cmd = { exec: { exe_script: script } };
    let batch_id = await this._send(rand_hex(32), cmd);
    return new Batch(this, batch_id, script.length);
  }

  async results(batch_id: string, timeout: number = 10): Promise<ExeScriptCommandResult[]> {
    let cmd = { getExecBatchResults: { command_index: undefined } };
    let res = await this._send(batch_id, cmd, timeout);
    return <ExeScriptCommandResult[]> res;
  }

  async _send(batch_id: string, cmd: object, timeout?: number): Promise<any> {
    let req = new SecureRequest(this._id, batch_id, cmd, timeout);
    let req_buf = Buffer.from(JSON.stringify(req));
    let enc_req = this._crypto_ctx.encrypt(req_buf);

    let {
      data: enc_res,
      status: status,
      statusText: status_text,
    } = await this._api.callEncrypted(
      this._id,
      // cannot be null / undefined;
      // overriden by transformRequest below
      '',
      {
        responseType: 'arraybuffer',
        headers: {
          'Content-Type': 'application/octet-stream',
          'Accept': 'application/octet-stream'
        },
        transformRequest: [
          // workaround for string conversion;
          // we _must_ send a Buffer object
          (_headers: any, _data: any) => enc_req,
        ],
        timeout: 0,
      }
    );

    let res_buf = this._crypto_ctx.decrypt(Buffer.from(enc_res));
    let res = SecureResponse.from_buffer(res_buf);
    return res.unwrap();
  }
}

class SecureRequest {
  constructor(
    private activityId: string,
    private batchId: string,
    private command: object,
    private timeout?: number) {}
}

class SecureResponse {
  command!: string;
  Ok?: any;
  Err?: any;

  static from_buffer(buffer: Buffer): SecureResponse {
    return Object.assign(
      new SecureResponse(),
      JSON.parse(buffer.toString())
    );
  }

  unwrap(): any {
    if (this.command == "error" || !!this.Err) {
      throw new Error(this.Err || this.Ok);
    }
    return this.Ok;
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
  private _activity!: Activity;
  private _batch_id!: string;
  private _size!: number;

  constructor(
    activity: Activity,
    batch_id: string,
    batch_size: number
  ) {
    this._activity = activity;
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
      let exe_list = await this._activity.results(this._batch_id);
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
