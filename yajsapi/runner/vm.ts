import { Field } from "../props/base";
import {
  DEFAULT_REPO_URL,
  Constraints,
  DemandDecor,
  resolve_url
} from "./common";
import {
  INF_RUNTIME,
  RuntimeType,
  ExeUnitRequest,
  InfBase,
} from "../props/inf";

export enum VmPackageFormat {
  UNKNOWN = "",
  GVMKIT_SQUASH = "gvmkit-squash",
}

class _InfVm extends InfBase {
  runtime = new Field({
    value: RuntimeType.VM,
    metadata: { key: INF_RUNTIME },
  });
}
const _InfVmKeys = InfBase.fields(
  new _InfVm(),
  ["cores", "mem", "storage", "runtime"]
);

class _VmConstrains extends Constraints {
  constructor(min_mem_gib: number, min_storage_gib: number, min_cores: number = 1) {
    super();
    super.extend([
      `(${_InfVmKeys["cores"]}>=${min_cores})`,
      `(${_InfVmKeys["mem"]}>=${min_mem_gib})`,
      `(${_InfVmKeys["storage"]}>=${min_storage_gib})`,
      `(${_InfVmKeys["runtime"]}=${RuntimeType.VM})`,
    ]);
  }
}

class _VmRequest extends ExeUnitRequest {
  package_format: Field = new Field({
    metadata: { key: "golem.srv.comp.vm.package_format" },
  });

  constructor(package_url: string, package_format: VmPackageFormat) {
    super(package_url);
    this.package_format.value = package_format;
  }
}

export async function repo(
  image_hash: string,
  min_mem_gib: number = 0.5,
  min_storage_gib: number = 2.0,
  min_cores: number = 1,
  image_format: VmPackageFormat = VmPackageFormat.GVMKIT_SQUASH,
  image_repo: string = DEFAULT_REPO_URL,
): Promise<DemandDecor> {
  /*
    Builds reference to a demand decorator.

    - *image_hash*: finds package by its contents hash.
    - *image_format* vm image format to use.
    - *image_repo* image repository to query.
    - *min_mem_gib*: minimal memory required to execute application code.
    - *min_storage_gib* minimal disk storage to execute tasks.
    - *min_cores* minimal cpu core count to execute tasks.

    */

  let pkg_url = await resolve_url(image_repo, image_hash);

  return new DemandDecor(
    new _VmConstrains(min_mem_gib, min_storage_gib, min_cores),
    new _VmRequest(pkg_url, image_format),
  );
}
