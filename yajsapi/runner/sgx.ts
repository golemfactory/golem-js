import { Field } from "../props/base";
import {
  DEFAULT_REPO_URL,
  Constraints,
  DemandDecor,
  resolve_url
} from "./common";
import {
  INF_CORES,
  INF_RUNTIME,
  ExeUnitRequest,
  InfBase,
  RuntimeType,
} from "../props/inf";
import * as fs from "fs";

class _InfSgxWasi extends InfBase {
  runtime = new Field({
    value: RuntimeType.SGX_WASI,
    metadata: { key: INF_RUNTIME },
  });
  cores: Field = new Field({ value: 1, metadata: { key: INF_CORES } });
}

const _InfSgxWasiKeys = InfBase.fields(
  new _InfSgxWasi(),
  ["cores", "mem", "storage", "runtime"]
);

class _SgxWasiConstrains extends Constraints {
  constructor(min_mem_gib: number, min_storage_gib: number) {
    super();
    super.extend([
      `(${_InfSgxWasiKeys["cores"]}>=1)`,
      `(${_InfSgxWasiKeys["mem"]}>=${min_mem_gib})`,
      `(${_InfSgxWasiKeys["storage"]}>=${min_storage_gib})`,
      `(${_InfSgxWasiKeys["runtime"]}=${RuntimeType.SGX_WASI})`,
    ]);
  }
}

class _InfSgxJsSp extends InfBase {
  runtime = new Field({
    value: RuntimeType.SGX_DENO,
    metadata: { key: INF_RUNTIME },
  });
  cores: Field = new Field({ value: 1, metadata: { key: INF_CORES } });
}

const _InfSgxJsSpKeys = InfBase.fields(
  new _InfSgxJsSp(),
  ["cores", "mem", "storage", "runtime"]);

class _SgxJsSpConstrains extends Constraints {
  constructor(min_mem_gib: number, min_storage_gib: number) {
    super();
    super.extend([
      `(${_InfSgxJsSpKeys["cores"]}>=1)`,
      `(${_InfSgxJsSpKeys["mem"]}>=${min_mem_gib})`,
      `(${_InfSgxJsSpKeys["storage"]}>=${min_storage_gib})`,
      `(${_InfSgxJsSpKeys["runtime"]}=${RuntimeType.SGX_DENO})`,
    ]);
  }
}

const SGX_HASH_SIZE: number = 32;
const DEFAULT_SGX_CONFIG = {
  "enableAttestation": true,
  "exeunitHashes": ["5edbb025714683961d4a2cb51b1d0a4ee8225a6ced167f29eb67f639313d9490"],
  "allowDebug": true,
  "allowOutdatedTcb": true,
  "maxEvidenceAge": 60
};

class SgxConfig {
  enableAttestation!: boolean;
  exeunitHashes!: Buffer[];
  allowDebug!: boolean;
  allowOutdatedTcb!: boolean;
  maxEvidenceAge!: number; // seconds

  static from_env(): SgxConfig {
    let sgx_config_env = process.env.YAGNA_SGX_CONFIG;
    let json = sgx_config_env
      ? fs.readFileSync(sgx_config_env)
      : DEFAULT_SGX_CONFIG;

    json["exeunitHashes"].forEach((hex: string) => {
      let buf = Buffer.from(hex, "hex");
      if (buf.byteLength != SGX_HASH_SIZE) {
        throw Error(`ExeUnit hash length != 32 for ${hex}`);
      }
    });

    let sgx_config: SgxConfig = Object.create(this.prototype);
    return Object.assign(sgx_config, json);
  }
}

export const SGX_CONFIG = SgxConfig.from_env();

export enum SgxEngine {
  WASI = "sgx",
  JS_SP = "sgx-js-sp",
}

export async function repo(
  engine: SgxEngine,
  image_hash: string,
  min_mem_gib: number = 0.5,
  min_storage_gib: number = 2.0,
  image_repo: string = DEFAULT_REPO_URL,
): Promise<DemandDecor> {
  /*
    Builds reference to a demand decorator.

    - *engine*: SGX runtime engine to use.
    - *image_hash*: finds package by its contents hash.
    - *image_repo* image repository to query.
    - *min_mem_gib*: minimal memory required to execute application code.
    - *min_storage_gib* minimal disk storage to execute tasks.

    */

  let pkg_url = await resolve_url(image_repo, image_hash);
  let secure = true;

  switch (engine) {
    case SgxEngine.JS_SP:
      return new DemandDecor(
        new _SgxJsSpConstrains(min_mem_gib, min_storage_gib),
        new ExeUnitRequest(pkg_url),
        secure,
      );
    case SgxEngine.WASI:
      return new DemandDecor(
        new _SgxWasiConstrains(min_mem_gib, min_storage_gib),
        new ExeUnitRequest(pkg_url),
        secure,
      );
    default:
      throw Error(`Invalid SGX runtime engine: ${engine}`);
  }
}
