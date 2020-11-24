import { Field, Model } from "./base";

export const INF_MEM: string = "golem.inf.mem.gib";
export const INF_STORAGE: string = "golem.inf.storage.gib";
export const INF_CORES: string = "golem.inf.cpu.cores";
export const INF_RUNTIME: string = "golem.runtime.name";
export const TRANSFER_CAPS: string = "golem.activity.caps.transfer.protocol";

export enum RuntimeType {
  UNKNOWN = "",
  WASMTIME = "wasmtime",
  EMSCRIPTEN = "emscripten",
  VM = "vm",
  SGX = "sgx",
  SGX_JS = "sgx-js",
  SGX_WASM = "sgx-wasm",
  SGX_WASI = "sgx-wasi",
}

export class InfBase {
  cores: Field = new Field({ metadata: { key: INF_CORES } });
  mem: Field = new Field({ metadata: { key: INF_MEM } });
  runtime: Field = new Field({ metadata: { key: INF_RUNTIME } });

  storage?: Field = new Field({ metadata: { key: INF_STORAGE } });
  transfers: Field = new Field({ metadata: { key: TRANSFER_CAPS } });

  static fields(inf: InfBase, keys: string[]) {
    return getFields(inf, keys);
  }
}

function getFields(obj: object, keys: string[]) {
  let fields = {};
  keys.forEach((key) => {
    fields[key] = obj[key].metadata.key;
  });

  return fields;
}

export class ExeUnitRequest extends Model {
  package_url: Field = new Field({
    metadata: { key: "golem.srv.comp.task_package" },
  });
  constructor(package_url: any) {
    super();
    this.package_url.value = package_url;
  }
}
