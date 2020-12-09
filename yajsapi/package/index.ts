import axios from "axios";
import { DemandBuilder } from "../props";
import { VmPackageFormat, VmRequest } from "../props/inf";

export const DEFAULT_REPO_URL = "http://3.249.139.167:8000";

export class Constraints {
  inner!: string[];

  constructor() {
    this.inner = [];
  }

  extend(items: string[]) {
    this.inner.push.apply(this.inner, items);
  }

  toString(): string {
    return `(&${this.inner.join("\n\t")})`;
  }
}

// Information on task package to be used for running tasks on providers.
export class Package {
  // Return package URL.
  async resolve_url(self): Promise<void | string> {}

  // Add package information to a Demand.
  async decorate_demand(demand: DemandBuilder) {}
}

export class VmPackage extends Package {
  repo_url!: string;
  image_hash!: string;
  constraints!: Constraints;
  public secure!: boolean;

  constructor({ repo_url, image_hash, constraints, secure = false }) {
    super();
    this.repo_url = repo_url;
    this.image_hash = image_hash;
    this.constraints = constraints;
    this.secure = secure;
  }

  async resolve_url(): Promise<string> {
    let resp = await axios.get(
      `${this.repo_url}/image.${this.image_hash}.link`
    );
    if (resp.status != 200) throw Error(`Error: ${resp.status}`);

    let image_url = await resp.data;
    const image_hash = this.image_hash;
    return `hash:sha3:${image_hash}:${image_url}`;
  }

  async decorate_demand(demand: DemandBuilder) {
    const image_url = await this.resolve_url();
    demand.ensure(this.constraints.toString());
    demand.add(new VmRequest(image_url, VmPackageFormat.GVMKIT_SQUASH));
  }
}
