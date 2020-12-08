import * as fs from "fs";
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
import { types } from "sgx-ias-js";

class _InfSgx extends InfBase {
  constructor(runtime: RuntimeType) {
    super();

    this.runtime = new Field({
      value: runtime,
      metadata: { key: INF_RUNTIME },
    });
    this.cores = new Field({ value: 1, metadata: { key: INF_CORES } });
  }
}

class _SgxConstrains extends Constraints {
  constructor(runtime: RuntimeType, min_mem_gib: number, min_storage_gib: number) {
    super();

    const fields = InfBase.fields(
      new _InfSgx(runtime),
      ["cores", "mem", "storage", "runtime"]
    );

    super.extend([
      `(${fields["cores"]}>=1)`,
      `(${fields["mem"]}>=${min_mem_gib})`,
      `(${fields["storage"]}>=${min_storage_gib})`,
      `(${fields["runtime"]}=${runtime})`,
    ]);
  }
}

const DEFAULT_SGX_CONFIG = {
  "enableAttestation": true,
  "exeunitHashes": ["5edbb025714683961d4a2cb51b1d0a4ee8225a6ced167f29eb67f639313d9490"],
  "allowDebug": true,
  "allowOutdatedTcb": true,
  "maxEvidenceAge": 60
};

class SgxConfig {
  enableAttestation!: boolean;
  exeunitHashes!: types.bytes.Bytes32[];
  allowDebug!: boolean;
  allowOutdatedTcb!: boolean;
  maxEvidenceAge!: number; // seconds

  static from_env(): SgxConfig {
    let env_path = process.env.YAGNA_SGX_CONFIG;
    let json = env_path
      ? fs.readFileSync(env_path)
      : DEFAULT_SGX_CONFIG;

    json["exeunitHashes"].forEach((hex: string, i: number) => {
      json["exeunitHashes"][i] = types.bytes.Bytes32.from(types.parseHex(hex));
    });

    let sgx_config: SgxConfig = Object.create(this.prototype);
    return Object.assign(sgx_config, json);
  }
}

export const SGX_CONFIG = SgxConfig.from_env();

export enum SgxEngine {
  GRAPHENE = "sgx",
  JS = "sgx-js",
  WASM = "sgx-wasm",
  WASI = "sgx-wasi",
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
  let runtime: RuntimeType;

  switch (engine) {
    case SgxEngine.GRAPHENE:
      runtime = RuntimeType.SGX;
      break;
    case SgxEngine.JS:
      runtime = RuntimeType.SGX_JS;
      break;
    case SgxEngine.WASM:
      runtime = RuntimeType.SGX_WASM;
      break;
    case SgxEngine.WASI:
      runtime = RuntimeType.SGX_WASI;
      break;
    default:
      throw Error(`Invalid SGX runtime: ${engine}`);
  }

  return new DemandDecor(
    new _SgxConstrains(runtime, min_mem_gib, min_storage_gib),
    new ExeUnitRequest(pkg_url),
    secure,
  );
}
