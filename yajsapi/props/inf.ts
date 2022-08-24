import { Field, Model } from "./base";

export const INF_MEM = "golem.inf.mem.gib";
export const INF_STORAGE = "golem.inf.storage.gib";
export const INF_CAPABILITIES = "golem.runtime.capabilities";
export const INF_CORES = "golem.inf.cpu.cores";
export const INF_THREADS = "golem.inf.cpu.threads";
export const INF_RUNTIME = "golem.runtime.name";
export const TRANSFER_CAPS = "golem.activity.caps.transfer.protocol";

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
  threads: Field = new Field({ metadata: { key: INF_THREADS } });
  mem: Field = new Field({ metadata: { key: INF_MEM } });
  runtime: Field = new Field({ metadata: { key: INF_RUNTIME } });

  storage?: Field = new Field({ metadata: { key: INF_STORAGE } });
  capabilities?: Field = new Field({ metadata: { key: INF_CAPABILITIES } });
  transfers: Field = new Field({ metadata: { key: TRANSFER_CAPS } });

  static fields(inf: InfBase, keys: string[]) {
    return getFields(inf, keys);
  }
}

export class InfVm extends InfBase {
  runtime = new Field({
    value: RuntimeType.VM,
    metadata: { key: INF_RUNTIME },
  });
}
export const InfVmKeys = InfBase.fields(new InfVm(), ["cores", "mem", "storage", "runtime", "threads", "capabilities"]);

function getFields(obj: object, keys: string[]) {
  const fields = {};
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

export class ExeUnitManifestRequest extends Model {
  manifest: Field = new Field({
    metadata: { key: "golem.srv.comp.payload" },
  });
  manifest_sig: Field = new Field({
    metadata: { key: "golem.srv.comp.payload.sig" },
  });
  manifest_sig_algorithm: Field = new Field({
    metadata: { key: "golem.srv.comp.payload.sig.algorithm" },
  });
  manifest_cert: Field = new Field({
    metadata: { key: "golem.srv.comp.payload.cert" },
  });
  constructor({ manifest, manifest_sig, manifest_sig_algorithm, manifest_cert }) {
    super();
    this.manifest.value = manifest;
    this.manifest_sig.value = manifest_sig;
    this.manifest_sig_algorithm.value = manifest_sig_algorithm;
    this.manifest_cert.value = manifest_cert;
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

  constructor(package_url: string, package_format: VmPackageFormat) {
    super(package_url);
    this.package_format.value = package_format;
  }
}

export class VmManifestRequest extends ExeUnitManifestRequest {
  package_format: Field = new Field({
    metadata: { key: "golem.srv.comp.vm.package_format" },
  });

  constructor({
    manifest,
    manifest_sig,
    manifest_sig_algorithm,
    manifest_cert,
    package_format = VmPackageFormat.GVMKIT_SQUASH,
  }) {
    super({ manifest, manifest_sig, manifest_sig_algorithm, manifest_cert });
    this.package_format.value = package_format;
  }
}
