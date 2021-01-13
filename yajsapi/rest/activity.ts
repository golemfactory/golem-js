import EventSource from "eventsource";
import { BaseAPI } from "ya-ts-client/dist/ya-activity/base";
import {
  RequestorControlApi,
  RequestorStateApi,
} from "ya-ts-client/dist/ya-activity/api";
import * as yaa from "ya-ts-client/dist/ya-activity/src/models";
import { attest, types } from "sgx-ias-js";
import { Configuration } from "ya-ts-client/dist/ya-activity";
import {
  Credentials,
  ExeScriptCommandResult,
  SgxCredentials,
} from "ya-ts-client/dist/ya-activity/src/models";
import { CryptoCtx, PrivateKey, PublicKey, rand_hex } from "../crypto";
import { sleep, logger } from "../utils";
import * as events from "../executor/events";
import { Agreement } from "./market";
import { SGX_CONFIG } from "../package/sgx";
import * as utf8 from "utf8";
import dayjs, { Dayjs } from "dayjs";

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
  async new_activity(
    agreement: Agreement,
    secure: boolean = false
  ): Promise<Activity> {
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
    let { data: response } = await this._api.createActivity({ agreementId: agreement_id });
    let activity_id =
      typeof response == "string" ? response : response.activityId;
    return new Activity(activity_id, this._api, this._state);
  }

  async _create_secure_activity(agreement: Agreement): Promise<SecureActivity> {
    let priv_key = new PrivateKey();
    let pub_key = priv_key.publicKey();
    let crypto_ctx: CryptoCtx;

    let { data: response } = await this._api.createActivity({
      agreementId: agreement.id(),
      requestorPubKey: pub_key.toString(),
    });

    let activity_id =
      typeof response == "string" ? response : response.activityId;
    let credentials =
      typeof response == "string" ? undefined : response.credentials;

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

  async _attest(
    activity_id: string,
    agreement: Agreement,
    credentials: Credentials
  ) {
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
class Activity {
  protected _api!: RequestorControlApi;
  protected _state!: RequestorStateApi;
  protected _id!: string;
  protected _credentials?: object;

  constructor(
    id: string,
    _api: RequestorControlApi,
    _state: RequestorStateApi
  ) {
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
    return SGX_CONFIG.exeunitHashes.map((value) => value.toString());
  }

  async state(): Promise<yaa.ActivityState> {
    let { data: result } = await this._state.getActivityState(this._id);
    let state: yaa.ActivityState = result;
    return state;
  }

  async send(
    script: object[],
    stream: boolean,
    deadline?: Dayjs
  ): Promise<any> {
    const script_txt = JSON.stringify(script);
    const { data: batch_id } = await this._api.exec(
      this._id,
      new ExeScriptRequest(script_txt)
    );

    if (stream) {
      return new StreamingBatch(
        this._api,
        this._id,
        batch_id,
        script.length,
        deadline
      );
    }
    return new PollingBatch(
      this._api,
      this._id,
      batch_id,
      script.length,
      deadline
    );
  }

  async ready(): Promise<Activity> {
    return this;
  }

  async done(): Promise<void> {
    try {
      const deadline = dayjs.utc().add(10, "s");
      const batch = await this.send([{ terminate: {} }], false, deadline);
      for await (let evt_ctx of batch) {
        logger.debug(`Command output for 'terminate' ${evt_ctx}`);
      }
      logger.debug(`Successfully terminated activity' ${this._id}`);
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

  async send(
    script: object[],
    stream: boolean,
    deadline?: Dayjs
  ): Promise<any> {
    let cmd = { exec: { exe_script: script } };
    let batch_id = await this._send(rand_hex(32), cmd);

    if (stream) {
      return new StreamingBatch(
        this._api,
        this._id,
        batch_id,
        script.length,
        deadline
      );
    }
    return new PollingBatch(
      this._api,
      this._id,
      batch_id,
      script.length,
      deadline
    );
  }

  async _send(batch_id: string, cmd: object, timeout?: number): Promise<any> {
    let req = new SecureRequest(this._id, batch_id, cmd, timeout);
    let req_buf = Buffer.from(JSON.stringify(req));
    let enc_req = this._crypto_ctx.encrypt(req_buf);

    let { data: enc_res } = await this._api.callEncrypted(
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
    private timeout?: number
  ) {}
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
  idx!: Number;
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

class BatchTimeoutError extends Error {}

class Batch implements AsyncIterable<events.CommandEventContext> {
  protected api!: RequestorControlApi;
  protected activity_id!: string;
  protected batch_id!: string;
  protected size!: number;
  protected deadline?: Dayjs;
  protected credentials?: SgxCredentials;

  constructor(
    api: RequestorControlApi,
    activity_id: string,
    batch_id: string,
    batch_size: number,
    deadline?: Dayjs,
    credentials?: SgxCredentials
  ) {
    this.api = api;
    this.activity_id = activity_id;
    this.batch_id = batch_id;
    this.size = batch_size;
    this.deadline = deadline ? deadline : dayjs().utc().add(365000, "day");
    this.credentials = credentials;
  }

  milliseconds_left(): number | undefined {
    const now = dayjs().utc();
    return this.deadline && this.deadline.diff(now, "millisecond");
  }

  id() {
    this.batch_id;
  }

  async *[Symbol.asyncIterator](): any {}
}

class PollingBatch extends Batch {
  constructor(
    api: RequestorControlApi,
    activity_id: string,
    batch_id: string,
    batch_size: number,
    deadline?: Dayjs
  ) {
    // this._api, this._id, batch_id, script.length, deadline
    super(api, activity_id, batch_id, batch_size, deadline);
  }

  async *[Symbol.asyncIterator](): any {
    // AsyncGenerator<Result, any, unknown>
    let last_idx = 0,
      results: yaa.ExeScriptCommandResult[] = [];
    while (last_idx < this.size) {
      const timeout = this.milliseconds_left();
      if (timeout && timeout <= 0) {
        throw new BatchTimeoutError();
      }
      try {
        let { data } = await this.api.getExecBatchResults(
          this.activity_id,
          this.batch_id,
          undefined,
          { timeout: timeout ? Math.min(timeout, 5000) : 5000 }
        );
        results = data;
      } catch (error) {
        if (error.response && error.response.status === 408) {
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
      let any_new: boolean = false;
      results = results.slice(last_idx);
      for (let result of results) {
        any_new = true;
        if (last_idx != result.index)
          throw `Expected ${last_idx}, got ${result.index}`;

        const { message, stdout, stderr } = result;
        let _message: string = "";

        if (message) {
          _message = message;
        } else if (stdout || stderr) {
          _message = JSON.stringify({ stdout, stderr });
        }

        let evt = Object.create(events.CommandExecuted.prototype);
        evt.idx = result.index;
        evt.stdout = result.stdout;
        evt.stderr = result.stderr;
        evt.message = result.message;
        yield new events.CommandEventContext({
          evt_cls: events.CommandExecuted,
          props: evt,
        });
        last_idx = result.index + 1;
        if (result.isBatchFinished) break;
        if (!any_new) await sleep(10);
      }
    }
    return;
  }
}

class StreamingBatch extends Batch {
  constructor(
    api: RequestorControlApi,
    activity_id: string,
    batch_id: string,
    batch_size: number,
    deadline?: Dayjs
  ) {
    super(api, activity_id, batch_id, batch_size, deadline);
  }

  async *[Symbol.asyncIterator](): any {
    const activity_id = this.activity_id;
    const batch_id = this.batch_id;
    const last_idx = this.size - 1;

    let config_prov = new ApiConfigProvider(this.api);
    let host = config_prov.base_path();
    let api_key = await config_prov.api_key();

    let evtSource = new EventSource(
      `${host}/activity/${activity_id}/exec/${batch_id}`,
      {
        headers: {
          Accept: "text/event-stream",
          Authorization: api_key ? `Bearer ${api_key}` : undefined,
        },
      }
    );

    let results: events.CommandEventContext[] = [];
    let finished = false;

    let resolve: (value?: any) => void;
    let promise = new Promise((r) => (resolve = r));

    const on_error = (e: object) => {
      if (!e) return;
      let msg = !e["message"] ? "source unavailable" : e["message"];
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

function _command_event_ctx(msg_event) {
  if (msg_event.type === "runtime") {
    throw Error(`Unsupported event: ${msg_event.type}`);
  }

  const evt_obj = JSON.parse(msg_event.data);
  const evt_kind = evt_obj["kind"][0];
  const evt_data = evt_obj["kind"][evt_kind]; // ?

  let evt_cls!: typeof events.CommandEvent;
  let props: { [key: string]: any } = { cmd_idx: parseInt(evt_obj["index"]) };

  switch (evt_kind) {
    case "started":
      if (!(evt_obj instanceof Object && evt_data["command"])) {
        throw Error("Invalid CommandStarted event: missing 'command'");
      }
      evt_cls = events.CommandStarted;
      props["command"] = evt_data["command"];
    case "finished":
      if (!(evt_obj instanceof Object && Number(evt_data["return_code"]))) {
        throw Error("Invalid CommandFinished event: missing 'return code'");
      }
      evt_cls = events.CommandExecuted;
      props["success"] = parseInt(evt_data["return_code"]) === 0;
      props["message"] = evt_data["message"];
    case "stdout":
      evt_cls = events.CommandStdOut;
      props["output"] = JSON.stringify(evt_data) || "";
    case "stderr":
      evt_cls = events.CommandStdErr;
      props["output"] = JSON.stringify(evt_data) || "";
    default:
      throw Error(`Unsupported runtime event: ${evt_kind}`);
  }
  return new events.CommandEventContext({ evt_cls, props });
}

export class ApiConfigProvider extends BaseAPI {
  constructor(api: BaseAPI) {
    let as_this: ApiConfigProvider = <ApiConfigProvider>api;
    super(as_this.configuration, as_this.basePath, as_this.axios);
  }

  base_path(): string {
    return this.configuration && this.configuration.basePath
      ? this.configuration.basePath
      : "";
  }

  async api_key(): Promise<string | undefined> {
    let api_key = this.configuration ? this.configuration.apiKey : undefined;
    if (typeof api_key === "string") {
      return api_key;
    }
    return undefined;
  }
}
