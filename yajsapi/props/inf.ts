import { Field, Model } from "./base";

const INF_MEM: string = "golem.inf.mem.gib";
const INF_STORAGE: string = "golem.inf.storage.gib";
const INF_CORES: string = "golem.inf.cpu.cores";
const INF_RUNTIME: string = "golem.runtime.name";
const TRANSFER_CAPS: string = "golem.activity.caps.transfer.protocol";

export enum RuntimeType {
  UNKNOWN = "",
  WASMTIME = "wasmtime",
  EMSCRIPTEN = "emscripten",
  VM = "vm",
}

enum WasmInterface {
  WASI_0 = "0",
  WASI_0preview1 = "0preview1",
}

export class InfBase {
  mem: Field = new Field({ metadata: { key: INF_MEM } });
  runtime: Field = new Field({ metadata: { key: INF_RUNTIME } });

  storage?: Field = new Field({ metadata: { key: INF_STORAGE } });
  transfers: Field = new Field({ metadata: { key: TRANSFER_CAPS } });
}

export class InfVm extends InfBase {
  runtime = new Field({
    value: RuntimeType.VM,
    metadata: { key: INF_RUNTIME },
  });
  cores: Field = new Field({ value: 1, metadata: { key: INF_CORES } });
}

export const InfVmKeys = getFields(new InfVm(), ["mem", "storage", "runtime"]);

function getFields(obj, keys) {
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
  constructor(package_url) {
    super();
    this.package_url.value = package_url;
  }
}

export enum VmPackageFormat {
  UNKNOWN = "",
  GVMKIT_SQUASH = "gvmkit-squash",
}

export class VmRequest extends ExeUnitRequest {
  package_format: Field = new Field({
    metadata: { key: "golem.srv.comp.vm.package_format" },
  });

  constructor(package_url, package_format) {
    super(package_url);
    this.package_format.value = package_format;
  }
}
