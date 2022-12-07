import { Activity, ActivityOptions } from "./activity";
import { CryptoCtx, PrivateKey, PublicKey, rand_hex } from "../utils/crypto";
import { SGX_CONFIG } from "../package/sgx";
import { attest, types } from "sgx-ias-js/index";
import * as utf8 from "utf8";
import { Credentials } from "ya-ts-client/dist/ya-activity/src/models";
import { yaActivity } from "ya-ts-client";
import { ActivityConfig } from "./config";

export async function createSecureActivity(agreementId: string, options?: ActivityConfig): Promise<SecureActivity> {
  if (!options?.taskPackage) {
    throw new Error("Task package option is required for create secure activity");
  }
  const privateKey = new PrivateKey();
  const publicKey = privateKey.publicKey();
  let cryptoCtx: CryptoCtx;

  const { data: response } = await options.api.control.createActivity(
    {
      agreementId,
      requestorPubKey: publicKey.toString(),
    },
    25,
    { timeout: 30000 }
  );

  const activityId = typeof response == "string" ? response : response.activityId;
  const credentials = typeof response == "string" ? undefined : response.credentials;

  try {
    if (!credentials) {
      throw Error("Missing credentials in CreateActivity response");
    }
    if (publicKey.toString() != credentials.sgx.requestorPubKey) {
      throw Error("Invalid requestor public key in CreateActivity response");
    }

    const enclave_key = PublicKey.fromHex(credentials.sgx.enclavePubKey);
    cryptoCtx = await CryptoCtx.from(enclave_key, privateKey);

    if (SGX_CONFIG.enableAttestation) {
      const evidence: attest.AttestationResponse = {
        report: credentials.sgx.iasReport,
        signature: types.parseHex(credentials.sgx.iasSig),
      };
      const verifier = attest.AttestationVerifier.from(evidence)
        .data(types.parseHex(credentials.sgx.requestorPubKey))
        .data(types.parseHex(credentials.sgx.enclavePubKey))
        .data(new TextEncoder().encode(options.taskPackage)) // encode as utf-8 bytes
        .mr_enclave_list(SGX_CONFIG.exeunitHashes)
        .nonce(utf8.encode(activityId)) // encode as utf-8 string
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
  } catch (error) {
    await options.api.control.destroyActivity(activityId, 10, { timeout: 11000 });
    throw error;
  }

  return new SecureActivity(activityId, agreementId, credentials, cryptoCtx, options);
}

export class SecureActivity extends Activity {
  constructor(
    public readonly id,
    public readonly activityId,
    private credentials: Credentials,
    private cryptoCtx: CryptoCtx,
    protected readonly options: ActivityConfig
  ) {
    super(id, activityId, options);
  }
  protected async send(script: yaActivity.ExeScriptRequest): Promise<string> {
    const secureRequest = {
      activityId: this.id,
      batchId: rand_hex(32),
      command: { exec: { exe_script: script } },
      timeout: this.options.requestTimeout,
    };
    const requestBuffer = Buffer.from(JSON.stringify(secureRequest));
    const encryptedRequest = this.cryptoCtx.encrypt(requestBuffer);

    const { data: encryptedResponse } = await this.options.api.control.callEncrypted(this.id, "", {
      responseType: "arraybuffer",
      headers: {
        "Content-Type": "application/octet-stream",
        Accept: "application/octet-stream",
      },
      // workaround for string conversion; we _must_ send a Buffer object
      transformRequest: [() => encryptedRequest],
      timeout: 0,
    });

    const responseBuffer = this.cryptoCtx.decrypt(Buffer.from(encryptedResponse));
    const response = Object.assign({}, JSON.parse(responseBuffer.toString()));
    if (response?.command == "error" || !!response?.Err) {
      throw new Error(response?.Err || response.Ok);
    }
    return response?.Ok;
  }
}
