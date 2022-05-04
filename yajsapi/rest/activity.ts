import EventSource from "eventsource";
import { BaseAPI } from "ya-ts-client/dist/ya-activity/base";
import { RequestorControlApi, RequestorStateApi } from "ya-ts-client/dist/ya-activity/api";
import * as yaa from "ya-ts-client/dist/ya-activity/src/models";
import { attest, types } from "sgx-ias-js";
import { Configuration } from "ya-ts-client/dist/ya-activity";
import {
  ActivityStateStateEnum,
  Credentials,
  ExeScriptCommandResult,
  ExeScriptCommandResultResultEnum,
  SgxCredentials,
} from "ya-ts-client/dist/ya-activity/src/models";
import { CryptoCtx, PrivateKey, PublicKey, rand_hex } from "../crypto";
import { sleep, logger, CancellationToken } from "../utils";
import * as events from "../executor/events";
import { Agreement } from "./market";
import { SGX_CONFIG } from "../package/sgx";
import * as utf8 from "utf8";
import dayjs, { Dayjs } from "dayjs";
import { suppress_exceptions, is_intermittent_error } from "./common";

/**
 * A convenience helper to facilitate the creation of an Activity.
 */
export class ActivityService {
  private _api!: RequestorControlApi;
  private _state!: RequestorStateApi;

  constructor(cfg: Configuration) {
    this._api = new RequestorControlApi(cfg);
    this._state = new RequestorStateApi(cfg);
  }

  /**
   * Create an activity within bounds of the specified agreement.
   *
   * @param agreement -
   * @param secure    -
   * @returns Activity
   */
  async new_activity(agreement: Agreement, secure = false): Promise<Activity> {
    try {
      if (secure) {
        return await this._create_secure_activity(agreement);
      } else {
        return await this._create_activity(agreement.id());
      }
    } catch (error) {
      logger.warn(`Failed to create activity for agreement ${agreement.id()}: ${error}`);
      throw error;
    }
  }

  async _create_activity(agreement_id: string): Promise<Activity> {
    const { data: response } = await this._api.createActivity({ agreementId: agreement_id }, 25, { timeout: 30000 });
    const activity_id = typeof response == "string" ? response : response.activityId;
    logger.debug(`Created activity ${activity_id} for agreement ${agreement_id}`);
    return new Activity(activity_id, this._api, this._state);
  }

  async _create_secure_activity(agreement: Agreement): Promise<SecureActivity> {
    const priv_key = new PrivateKey();
    const pub_key = priv_key.publicKey();
    let crypto_ctx: CryptoCtx;

    const { data: response } = await this._api.createActivity(
      {
        agreementId: agreement.id(),
        requestorPubKey: pub_key.toString(),
      },
      25,
      { timeout: 30000 }
    );

    const activity_id = typeof response == "string" ? response : response.activityId;
    const credentials = typeof response == "string" ? undefined : response.credentials;

    try {
      if (!credentials) {
        throw Error("Missing credentials in CreateActivity response");
      }
      if (pub_key.toString() != credentials.sgx.requestorPubKey) {
        throw Error("Invalid requestor public key in CreateActivity response");
      }

      const enclave_key = PublicKey.fromHex(credentials.sgx.enclavePubKey);
      crypto_ctx = await CryptoCtx.from(enclave_key, priv_key);

      if (SGX_CONFIG.enableAttestation) {
        await this._attest(activity_id, agreement, credentials);
      }
    } catch (error) {
      await this._api.destroyActivity(activity_id, 10, { timeout: 11000 });
      throw error;
    }

    return new SecureActivity(activity_id, credentials.sgx, crypto_ctx, this._api, this._state);
  }

  async _attest(activity_id: string, agreement: Agreement, credentials: Credentials) {
    const demand = (await agreement.details()).raw_details.demand;
    const pkg = demand.properties["golem.srv.comp.task_package"];

    if (!pkg) {
      throw new Error("Invalid agreement: missing package");
    }

    const evidence: attest.AttestationResponse = {
      report: credentials.sgx.iasReport,
      signature: types.parseHex(credentials.sgx.iasSig),
    };
    const verifier = attest.AttestationVerifier.from(evidence)
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

    const result = verifier.verify();
    if (result.verdict != attest.AttestationVerdict.Ok) {
      const name = result.verdict.toString();
      throw new Error(`Attestation failed: ${name}: ${result.message}`);
    }
  }
}

class ExeScriptRequest implements yaa.ExeScriptRequest {
  text!: string;
  constructor(text: string) {
    this.text = text;
  }
}

// Mid-level wrapper for REST's Activity endpoint
export class Activity {
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

  get api(): RequestorControlApi {
    return this._api;
  }

  get credentials(): object | undefined {
    return this._credentials;
  }

  get exeunitHashes(): string[] | undefined {
    return SGX_CONFIG.exeunitHashes.map((value) => value.toString());
  }

  async state(): Promise<yaa.ActivityState> {
    const { data: result } = await this._state.getActivityState(this._id);
    const state: yaa.ActivityState = result;
    return state;
  }

  async send(
    script: object[],
    stream: boolean,
    deadline?: number,
    cancellationToken?: CancellationToken
  ): Promise<any> {
    const script_txt = JSON.stringify(script);
    let batch_id;
    try {
      const { data } = await this._api.exec(this._id, new ExeScriptRequest(script_txt), { timeout: 10000 });
      batch_id = data;
    } catch (error) {
      logger.warn(`Error while sending batch script to provider: ${error}`);
      throw error;
    }

    if (stream) {
      return new StreamingBatch(this, batch_id, script.length, deadline, cancellationToken);
    }
    return new PollingBatch(this, batch_id, script.length, deadline, cancellationToken);
  }

  async ready(): Promise<Activity> {
    return this;
  }

  async done(): Promise<void> {
    try {
      await this._api.destroyActivity(this._id, 10, { timeout: 11000 });
    } catch (error) {
      logger.warn(`Got API Exception when destroying activity ${this._id}: ${error}`);
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

  async send(script: object[], stream: boolean, deadline?: number): Promise<any> {
    const cmd = { exec: { exe_script: script } };
    const batch_id = await this._send(rand_hex(32), cmd);

    if (stream) {
      return new StreamingBatch(this, batch_id, script.length, deadline);
    }
    return new PollingBatch(this, batch_id, script.length, deadline);
  }

  async _send(batch_id: string, cmd: object, timeout?: number): Promise<any> {
    const req = new SecureRequest(this._id, batch_id, cmd, timeout);
    const req_buf = Buffer.from(JSON.stringify(req));
    const enc_req = this._crypto_ctx.encrypt(req_buf);

    const { data: enc_res } = await this._api.callEncrypted(
      this._id,
      // cannot be null / undefined;
      // overriden by transformRequest below
      "",
      {
        responseType: "arraybuffer",
        headers: {
          "Content-Type": "application/octet-stream",
          Accept: "application/octet-stream",
        },
        transformRequest: [
          // workaround for string conversion;
          // we _must_ send a Buffer object
          (_headers: any, _data: any) => enc_req,
        ],
        timeout: 0,
      }
    );

    const res_buf = this._crypto_ctx.decrypt(Buffer.from(enc_res));
    const res = SecureResponse.from_buffer(res_buf);
    return res.unwrap();
  }
}

class SecureRequest {
  constructor(private activityId: string, private batchId: string, private command: object, private timeout?: number) {}
}

class SecureResponse {
  command!: string;
  Ok?: any;
  Err?: any;

  static from_buffer(buffer: Buffer): SecureResponse {
    return Object.assign(new SecureResponse(), JSON.parse(buffer.toString()));
  }

  unwrap(): any {
    if (this.command == "error" || !!this.Err) {
      throw new Error(this.Err || this.Ok);
    }
    return this.Ok;
  }
}

class Result {
  idx!: number;
  stdout?: string;
  stderr?: string;
  message?: string;
}

export class CommandExecutionError extends Error {
  command: string;
  message: string;
  constructor(command: string, message?: string) {
    super(message);
    this.command = command;
    this.message = message || "";
  }
  toString() {
    return this.message;
  }
}

class BatchTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = "BatchTimeoutError";
  }
}

class Batch implements AsyncIterable<events.CommandEventContext> {
  protected activity!: Activity;
  protected batch_id!: string;
  protected size!: number;
  protected deadline?: Dayjs;
  protected credentials?: SgxCredentials;
  protected cancellationToken?: CancellationToken;

  constructor(
    activity: Activity,
    batch_id: string,
    batch_size: number,
    deadline?: number,
    credentials?: SgxCredentials,
    cancellationToken?: CancellationToken
  ) {
    this.activity = activity;
    this.batch_id = batch_id;
    this.size = batch_size;
    this.deadline = deadline ? dayjs.unix(deadline) : dayjs().utc().add(1, "day");
    this.credentials = credentials;
    this.cancellationToken = cancellationToken;
  }

  milliseconds_left(): number | undefined {
    const now = dayjs().utc();
    return this.deadline && this.deadline.diff(now, "millisecond");
  }

  id() {
    this.batch_id;
  }

  async *[Symbol.asyncIterator](): any {
    // abstract
  }
}

function _is_gsb_endpoint_not_found_error(error): boolean {
  // check if `err` is caused by "endpoint address not found" GSB error
  if (!error.response) {
    return false;
  }
  if (error.response.status !== 500) {
    return false;
  }
  if (!error.response.data || !error.response.data.message) {
    logger.debug(`Cannot read error message, response: ${error.response}`);
    return false;
  }
  const message = error.response.data.message;
  return message.includes("endpoint address not found") && message.includes("GSB error");
}

class PollingBatch extends Batch {
  constructor(
    activity: Activity,
    batch_id: string,
    batch_size: number,
    deadline?: number,
    cancellationToken?: CancellationToken
  ) {
    // this._api, this._id, batch_id, script.length, deadline
    super(activity, batch_id, batch_size, deadline, undefined, cancellationToken);
  }

  async _activity_terminated(): Promise<{ terminated: boolean; reason?: string; err?: string }> {
    // check if the activity we're using is in the "Terminated" state
    try {
      const state = await this.activity.state();
      return {
        terminated: state.state && state.state.includes(ActivityStateStateEnum.Terminated),
        reason: state.reason,
        err: state.errorMessage,
      };
    } catch (err) {
      logger.debug(`Cannot query activity state: ${err}`);
      return { terminated: false };
    }
  }

  async *[Symbol.asyncIterator](): any {
    // AsyncGenerator<Result, any, unknown>
    let last_idx = 0,
      results: yaa.ExeScriptCommandResult[] = [];
    let retry_count = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2.0;
    while (last_idx < this.size) {
      const timeout = this.milliseconds_left();
      if (this.cancellationToken && this.cancellationToken.cancelled) {
        throw new CommandExecutionError(last_idx.toString(), "Interrupted.");
      }
      if (timeout && timeout <= 0) {
        throw new BatchTimeoutError(`Task timeout for activity ${this.activity.id}`);
      }
      try {
        const { data } = await this.activity.api.getExecBatchResults(this.activity.id, this.batch_id, last_idx, 5, {
          timeout: 6000,
        });
        results = data;
      } catch (error) {
        const timeout_msg = error.message && error.message.includes("timeout");
        if (error.response && error.response.status === 408) {
          continue;
        } else if (error.code === "ETIMEDOUT" || (error.code === "ECONNABORTED" && timeout_msg)) {
          continue;
        } else {
          const { terminated, reason, err } = await this._activity_terminated();
          if (terminated) {
            logger.warn(`Activity ${this.activity.id} terminated by provider. Reason: ${reason}, err: ${err}`);
            throw error;
          }
          if (!_is_gsb_endpoint_not_found_error(error)) {
            throw error;
          }
          ++retry_count;
          const fail_msg = "getExecBatchResults failed due to GSB error";
          if (retry_count < MAX_RETRIES) {
            logger.debug(`${fail_msg}, retrying in ${RETRY_DELAY}.`);
            await sleep(RETRY_DELAY);
            continue;
          } else {
            logger.debug(`${fail_msg}, giving up after ${retry_count} attempts.`);
          }
          const msg = error.response && error.response.data ? error.response.data.message : error;
          throw new CommandExecutionError(last_idx.toString(), `getExecBatchResults error: ${msg}`);
        }
      }
      retry_count = 0;
      let any_new = false;
      results = results.slice(last_idx);
      for (const result of results) {
        any_new = true;
        if (last_idx != result.index) throw `Expected ${last_idx}, got ${result.index}`;

        const { message, stdout, stderr } = result;
        let _message = "";

        if (message) {
          _message = message;
        } else if (stdout || stderr) {
          _message = JSON.stringify({ stdout, stderr });
        }

        const evt = Object.create(events.CommandExecuted.prototype);
        evt.cmd_idx = evt.idx = result.index;
        evt.stdout = result.stdout;
        evt.stderr = result.stderr;
        evt.message = result.message;
        evt.command = "";
        evt.success = result.result === ExeScriptCommandResultResultEnum.Ok;
        yield new events.CommandEventContext(evt);
        last_idx = result.index + 1;
        if (result.isBatchFinished) break;
      }
      if (!any_new) await sleep(3);
    }
    return;
  }
}

class StreamingBatch extends Batch {
  constructor(
    activity: Activity,
    batch_id: string,
    batch_size: number,
    deadline?: number,
    cancellationToken?: CancellationToken
  ) {
    super(activity, batch_id, batch_size, deadline, undefined, cancellationToken);
  }

  async *[Symbol.asyncIterator](): any {
    const activity_id = this.activity.id;
    const batch_id = this.batch_id;
    const last_idx = this.size - 1;

    const config_prov = new ApiConfigProvider(this.activity.api);
    const host = config_prov.base_path();
    const api_key = await config_prov.api_key();

    const evtSource = new EventSource(`${host}/activity/${activity_id}/exec/${batch_id}`, {
      headers: {
        Accept: "text/event-stream",
        Authorization: api_key ? `Bearer ${api_key}` : undefined,
      },
    });

    let results: events.CommandEventContext[] = [];
    let finished = false;

    let resolve: (value?: any) => void;
    let promise = new Promise((r) => (resolve = r));

    const on_error = (e: object) => {
      if (!e) return;
      const msg = !e["message"] ? "source unavailable" : e["message"];
      logger.error("Runtime event source error:", msg);
      cleanup();
    };
    const on_event = (e: object) => {
      try {
        results.push(events.CommandEventContext.fromJson(e["data"]));
        resolve();
        promise = new Promise((r) => (resolve = r));
      } catch (e) {
        logger.warn("Runtime event error:", e);
      }
    };
    const cleanup = () => {
      evtSource.removeEventListener("error", on_error);
      evtSource.removeEventListener("runtime", on_event);
      evtSource.close();

      finished = true;
      resolve();
    };

    evtSource.addEventListener("error", on_error);
    evtSource.addEventListener("runtime", on_event);

    while (!finished) {
      await promise;

      for (const result of results) {
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

function _command_event_ctx(msg_event) {
  if (msg_event.type === "runtime") {
    throw Error(`Unsupported event: ${msg_event.type}`);
  }
  let evt_obj;
  try {
    evt_obj = JSON.parse(msg_event.data);
  } catch (_e) {
    throw Error(`Cannot parse: ${msg_event.data}`);
  }
  const evt_kind = evt_obj["kind"][0];
  const evt_data = evt_obj["kind"][evt_kind]; // ?

  let evt_cls!: typeof events.CommandEvent;
  const props: { [key: string]: any } = { cmd_idx: parseInt(evt_obj["index"]) };

  switch (evt_kind) {
    case "started":
      if (!(evt_obj instanceof Object && evt_data["command"])) {
        throw Error("Invalid CommandStarted event: missing 'command'");
      }
      evt_cls = events.CommandStarted;
      props["command"] = evt_data["command"];
      break;
    case "finished":
      if (!(evt_obj instanceof Object && Number(evt_data["return_code"]))) {
        throw Error("Invalid CommandFinished event: missing 'return code'");
      }
      evt_cls = events.CommandExecuted;
      props["success"] = parseInt(evt_data["return_code"]) === 0;
      props["message"] = evt_data["message"];
      break;
    case "stdout":
      evt_cls = events.CommandStdOut;
      props["output"] = JSON.stringify(evt_data) || "";
      break;
    case "stderr":
      evt_cls = events.CommandStdErr;
      props["output"] = JSON.stringify(evt_data) || "";
      break;
    default:
      throw Error(`Unsupported runtime event: ${evt_kind}`);
  }
  return new events.CommandEventContext({ evt_cls, props });
}

export class ApiConfigProvider extends BaseAPI {
  constructor(api: BaseAPI) {
    const as_this: ApiConfigProvider = <ApiConfigProvider>api;
    super(as_this.configuration, as_this.basePath, as_this.axios);
  }

  base_path(): string {
    return this.configuration && this.configuration.basePath ? this.configuration.basePath : "";
  }

  async api_key(): Promise<string | undefined> {
    const api_key = this.configuration ? this.configuration.apiKey : undefined;
    if (typeof api_key === "string") {
      return api_key;
    }
    return undefined;
  }
}
