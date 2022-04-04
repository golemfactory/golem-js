import { RuntimeType, InfVmKeys } from "../props/inf";
import { Constraints, DEFAULT_REPO_SRV, Package, RepoOpts, VmPackage, resolve_repo_srv } from ".";

class _VmConstrains extends Constraints {
  constructor(
    min_mem_gib: number,
    min_storage_gib: number,
    min_cpu_threads: number = 1,
    cores: number = 1,
    capabilities: string[] = []
  ) {
    super();
    const items = [
      // `(${_InfVmKeys["cores"]}>=${min_cores})`,
      `(${InfVmKeys["mem"]}>=${min_mem_gib})`,
      `(${InfVmKeys["storage"]}>=${min_storage_gib})`,
      `(${InfVmKeys["runtime"]}=${RuntimeType.VM})`,
    ];
    if (capabilities.length) {
      items.push(`(${InfVmKeys["capabilities"]}=${capabilities.join(',')})`)
    }
    super.extend(items);
  }
}

export async function repo({
  image_hash,
  min_mem_gib = 0.5,
  min_storage_gib = 2.0,
  min_cpu_threads = 1,
  cores = 1,
  capabilities = []
}: RepoOpts): Promise<Package> {
  /*
    Builds reference to a demand decorator.

    - *image_hash*: finds package by its contents hash.
    - *min_mem_gib*: minimal memory required to execute application code.
    - *min_storage_gib* minimal disk storage to execute tasks.
    - *min_cpu_threads*: minimal available logical CPU cores (CPU threads).

    */

  return new VmPackage({
    repo_url: await resolve_repo_srv({repo_srv: DEFAULT_REPO_SRV}),
    image_hash,
    constraints: new _VmConstrains(min_mem_gib, min_storage_gib, min_cpu_threads, cores, capabilities),
  });
}
