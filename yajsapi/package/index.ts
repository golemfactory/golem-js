import axios from "axios";
import * as srv from "srvclient";
import { DemandBuilder } from "../props";
import { VmPackageFormat, VmRequest } from "../props/inf";
import { logger } from "../utils";


const FALLBACK_REPO_URL = "http://3.249.139.167:8000";
export const DEFAULT_REPO_SRV = "_girepo._tcp.dev.golem.network";

export type RepoOpts = {
  engine?: string,
  image_hash: string;
  min_mem_gib: number;
  min_storage_gib: number;
};

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

export const resolve_repo_srv = async ({
  repo_srv,
  fallback_url = FALLBACK_REPO_URL,
}) => {
  async function _resolve_repo_srv() {
    return new Promise((resolve, reject) => {
      let verify_records = async function (err, records) {
        for (let record of records) {
          let url = `http://${record.name}:${record.port}`;
          try {
            await axios.head(url);
            resolve(url);
          } catch (error) {
            if (error.response != undefined) {
              resolve(url);
            }
          }
        }
        resolve(null);
      };

      srv.getRandomTargets(repo_srv, verify_records);
    });
  }

  const repo_url = await _resolve_repo_srv();
    if (repo_url) {
        logger.debug(`Using image repository: ${repo_srv} -> ${repo_url}.`);
        return repo_url;
    }
    logger.warn(`Problem resolving image repository: ${repo_srv}, falling back to ${fallback_url}.`);
    return fallback_url;
};
