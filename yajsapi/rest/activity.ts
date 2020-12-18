import {
  RequestorControlApi,
  RequestorStateApi,
} from "ya-ts-client/dist/ya-activity/api";
import * as yaa from "ya-ts-client/dist/ya-activity/src/models";
import { attest, types } from "sgx-ias-js";
import { Configuration } from "ya-ts-client/dist/ya-activity";
import { Credentials, ExeScriptCommandResult, SgxCredentials } from "ya-ts-client/dist/ya-activity/src/models";
import { CryptoCtx, PrivateKey, PublicKey, rand_hex } from "../crypto";
import { sleep, logger } from "../utils";
import { Agreement } from "./market";
import { SGX_CONFIG } from "../runner/sgx";
import * as utf8 from "utf8";

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

  async _create_activity(agreement_id: string): Promise<Activity> {
    let { data: response } = await this._api.createActivity(agreement_id);
    let activity_id = typeof response == "string"
      ? response
      : response.activityId;
    return new Activity(activity_id, this._api, this._state);
  }

  async _create_secure_activity(agreement: Agreement): Promise<SecureActivity> {
    let priv_key = new PrivateKey();
    let pub_key = priv_key.publicKey();
    let crypto_ctx: CryptoCtx;

    let {
      data: response,
    } = await this._api.createActivity({
      agreementId: agreement.id(),
      requestorPubKey: pub_key.toString(),
    });

    let activity_id = typeof response == "string"
      ? response
      : response.activityId;
    let credentials = typeof response == "string"
      ? undefined
      : response.credentials;

    try {
      if (!credentials) {
        throw Error("Missing credentials in CreateActivity response");
      }
      if (pub_key.toString() != credentials.sgx.requestorPubKey) {
        throw Error("Invalid requestor public key in CreateActivity response");
      }

      let enclave_key = PublicKey.fromHex(credentials.sgx.enclavePubKey);
      crypto_ctx = await CryptoCtx.from(enclave_key, priv_key);

      if (SGX_CONFIG.enableAttestation) {
        await this._attest(activity_id, agreement, credentials);
      }

    } catch (error) {
      await this._api.destroyActivity(activity_id);
      throw error;
    }

    return new SecureActivity(
      activity_id,
      credentials.sgx,
      crypto_ctx,
      this._api,
      this._state
    );
  }

  async _attest(activity_id: string, agreement: Agreement, credentials: Credentials) {
    let demand = (await agreement.details()).raw_details.demand;
    let pkg = demand.properties["golem.srv.comp.task_package"];

    if (!pkg) {
      throw new Error("Invalid agreement: missing package");
    }

    let evidence: attest.AttestationResponse = {
      report: credentials.sgx.iasReport,
      signature: types.parseHex(credentials.sgx.iasSig),
    };
    let verifier = attest.AttestationVerifier.from(evidence)
      .data(types.parseHex(credentials.sgx.requestorPubKey))
      .data(types.parseHex(credentials.sgx.enclavePubKey))
      .data(new TextEncoder().encode(pkg)) // encode as utf-8 bytes
      .mr_enclave_list(SGX_CONFIG.exeunitHashes)
      .nonce(utf8.encode(activity_id)) // encode as utf-8 string
      .max_age(SGX_CONFIG.maxEvidenceAge);

    if (!SGX_CONFIG.allowDebug) {
      verifier.not_debug();
    }
    if (!SGX_CONFIG.allowOutdatedTcb) {
      verifier.not_outdated();
    }

    let result = verifier.verify();
    if (result.verdict != attest.AttestationVerdict.Ok) {
      let name = result.verdict.toString();
      throw new Error(`Attestation failed: ${name}: ${result.message}`)
    }
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
  protected _credentials?: object;

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

  get credentials(): object | undefined {
    return this._credentials;
  }

  get exeunitHashes(): string[] | undefined {
    return SGX_CONFIG.exeunitHashes.map(value => value.toString());
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

  async results(batch_id: string, timeout: number = 5): Promise<ExeScriptCommandResult[]> {
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
    try {
      const { data: batch_id } = await this._api.exec(
        this._id,
        new ExeScriptRequest('[{"terminate":{}}]')
      );
      //with contextlib.suppress(yexc.ApiException):
      try {
        await this._api.getExecBatchResults(this._id, batch_id, undefined, 1);
      } catch(error) {
        //suppress api error
      }
    } catch (error) {
      logger.error(`Failed to destroy activity: ${this._id}`);
    } finally {
      try {
        await this._api.destroyActivity(this._id);
      } catch (error) {
        //suppress api error
      }
    }
  }
}

class SecureActivity extends Activity {
  _crypto_ctx!: CryptoCtx;

  constructor(
    id: string,
    credentials: SgxCredentials,
    crypto_ctx: CryptoCtx,
    _api: RequestorControlApi,
    _state: RequestorStateApi
  ) {
    super(id, _api, _state);
    this._credentials = credentials;
    this._crypto_ctx = crypto_ctx;
  }

  async exec(script: object[]) {
    let cmd = { exec: { exe_script: script } };
    let batch_id = await this._send(rand_hex(32), cmd);
    return new Batch(this, batch_id, script.length);
  }

  async results(batch_id: string, timeout: number = 8): Promise<ExeScriptCommandResult[]> {
    let cmd = { getExecBatchResults: { command_index: undefined } };
    let res = await this._send(batch_id, cmd, timeout);
    return <ExeScriptCommandResult[]> res;
  }

  async _send(batch_id: string, cmd: object, timeout?: number): Promise<any> {
    let req = new SecureRequest(this._id, batch_id, cmd, timeout);
    let req_buf = Buffer.from(JSON.stringify(req));
    let enc_req = this._crypto_ctx.encrypt(req_buf);

    let { data: enc_res } = await this._api.callEncrypted(
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
  stdout?: string;
  stderr?: string;
  message?: string;
}

class CommandExecutionError extends Error {
  constructor(key: string, description: string) {
    super(description);
    this.name = key;
  }
  toString() {
    return this.message;
  }
}

class Batch implements AsyncIterable<Result> {
  private _activity!: Activity;
  private _batch_id!: string;
  private _size!: number;
  public credentials?: SgxCredentials;

  constructor(
    activity: Activity,
    batch_id: string,
    batch_size: number,
    credentials?: SgxCredentials,
  ) {
    this._activity = activity;
    this._batch_id = batch_id;
    this._size = batch_size;
    this.credentials = credentials;
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
      let results: yaa.ExeScriptCommandResult[] = []
      try {
        results = await this._activity.results(this._batch_id);
      } catch (error) {
        if (error.response && error.response.status == 408) {
          continue;
        } else {
          if (error.response && error.response.status == 500 && error.response.data) {
            throw new CommandExecutionError(
              last_idx.toString(),
              `Provider might have disconnected (error: ${error.response.data.message})`
            );
          }
          throw error;
        }
      }
      results = results.slice(last_idx);
      for (let result of results) {
        any_new = true;
        if (last_idx != result.index)
          throw `Expected ${last_idx}, got ${result.index}`;
        if (result.result.toString() == "Error")
          throw new CommandExecutionError(
            last_idx.toString(),
            result.stderr || result.message || ""
          );
        let _result = new Result();
        _result.idx = result.index;
        _result.stdout = result.stdout;
        _result.stderr = result.stderr;
        _result.message = result.message;
        yield _result;
        last_idx = result.index + 1;
        if (result.isBatchFinished) break;
      }
      if (!any_new) await sleep(3);
    }
    return;
  }
}
