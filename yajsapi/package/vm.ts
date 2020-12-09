import {
  RuntimeType,
  InfVmKeys,
} from "../props/inf";
import { Constraints, DEFAULT_REPO_URL, Package, VmPackage } from ".";

class _VmConstrains extends Constraints {
  constructor(min_mem_gib: number, min_storage_gib: number, min_cores: number = 1) {
    super();
    super.extend([
      // `(${_InfVmKeys["cores"]}>=${min_cores})`,
      `(${InfVmKeys["mem"]}>=${min_mem_gib})`,
      `(${InfVmKeys["storage"]}>=${min_storage_gib})`,
      `(${InfVmKeys["runtime"]}=${RuntimeType.VM})`,
    ]);
  }
}

export async function repo(
  image_hash: string,
  min_mem_gib: number = 0.5,
  min_storage_gib: number = 2.0
): Promise<Package> {
  /*
    Builds reference to a demand decorator.

    - *image_hash*: finds package by its contents hash.
    - *min_mem_gib*: minimal memory required to execute application code.
    - *min_storage_gib* minimal disk storage to execute tasks.

    */

  return new VmPackage({
    repo_url: DEFAULT_REPO_URL,
    image_hash,
    constraints: new _VmConstrains(min_mem_gib, min_storage_gib),
  });
}
