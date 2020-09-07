import axios from "axios";
import { DemandBuilder } from "../props/builder";
import {
  InfVmKeys,
  RuntimeType,
  VmRequest,
  VmPackageFormat,
} from "../props/inf";

const _DEFAULT_REPO_URL = "http://3.249.139.167:8000";

class _VmConstrains {
  public min_mem_gib!: number;
  public min_storage_gib!: number;
  public cores: number = 1;

  constructor(min_mem_gib, min_storage_gib, cores = 1) {
    this.min_mem_gib = min_mem_gib;
    this.min_storage_gib = min_storage_gib;
    this.cores = cores;
  }

  toString() {
    let rules = [
      `(${InfVmKeys["mem"]}>=${this.min_mem_gib})`,
      `(${InfVmKeys["storage"]}>=${this.min_storage_gib})`,
      `(${InfVmKeys["runtime"]}=${RuntimeType.VM})`,
    ].join("\n\t");
    return `(&${rules})`;
  }
}

export class Package {
  async resolve_url(): Promise<string> {
    return "";
  }
  async decorate_demand(demand: DemandBuilder) {}
}

class _VmPackage extends Package {
  repo_url!: string;
  image_hash!: string;
  constraints!: _VmConstrains;

  constructor(repo_url, image_hash, constraints) {
    super();
    this.repo_url = repo_url;
    this.image_hash = image_hash;
    this.constraints = constraints;
  }

  async resolve_url(): Promise<string> {
    let resp = await axios.get(
      `${this.repo_url}/image.${this.image_hash}.link`
    );
    if (resp.status != 200) throw Error(`Error: ${resp.status}`);

    let image_url = await resp.data;
    let image_hash = this.image_hash;
    return `hash:sha3:${image_hash}:${image_url}`;
  }

  async decorate_demand(demand: DemandBuilder) {
    let image_url = await this.resolve_url();
    demand.ensure(this.constraints.toString());
    demand.add(new VmRequest(image_url, VmPackageFormat.GVMKIT_SQUASH));
  }
}

export async function repo(
  image_hash: string,
  min_mem_gib: number = 0.5,
  min_storage_gib: number = 2.0
): Promise<_VmPackage> {
  /*
    Builds reference to application package.

    - *image_hash*: finds package by its contents hash.
    - *min_mem_gib*: minimal memory required to execute application code.
    - *min_storage_gib* minimal disk storage to execute tasks.

    */
  return new _VmPackage(
    _DEFAULT_REPO_URL,
    image_hash,
    new _VmConstrains(min_mem_gib, min_storage_gib)
  );
}
