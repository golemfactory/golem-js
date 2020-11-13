
import axios from "axios";
import { DemandBuilder } from "../props/builder";
import { ExeUnitRequest } from "../props/inf";

export const DEFAULT_REPO_URL = "http://3.249.139.167:8000";

export async function resolve_url(repo_url: string, image_hash: string): Promise<string> {
  let resp = await axios.get(
    `${repo_url}/image.${image_hash}.link`
  );
  if (resp.status != 200) throw Error(`Error: ${resp.status}`);

  let image_url = await resp.data;
  return `hash:sha3:${image_hash}:${image_url}`;
}

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

export class DemandDecor {
  constr!: Constraints;
  request!: ExeUnitRequest;
  public secure!: boolean;

  constructor(constr: Constraints, request: ExeUnitRequest, secure: boolean = false) {
    this.constr = constr;
    this.request = request;
    this.secure = secure;
  }

  async decorate_demand(demand: DemandBuilder) {
    demand.ensure(this.constr.toString());
    demand.add(this.request);
  }
}

