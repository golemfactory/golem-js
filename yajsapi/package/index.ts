import axios from "axios";
import * as srv from "srvclient";
import { DemandBuilder } from "../props";
import { VmPackageFormat, VmRequest, VmManifestRequest } from "../props/inf";
import { logger } from "../utils";

const FALLBACK_REPO_URL = "http://girepo.dev.golem.network:8000";
export const DEFAULT_REPO_SRV = "_girepo._tcp.dev.golem.network";

export type RepoOpts = {
  engine?: string;
  image_hash: string;
  min_mem_gib: number;
  min_storage_gib: number;
  min_cpu_threads?: number;
  cores?: number;
  capabilities?: string[];
};

export type ManifestOpts = {
  manifest: string;
  manifest_sig: string;
  manifest_sig_algorithm: string;
  manifest_cert: string;
  min_mem_gib?: number;
  min_storage_gib?: number;
  min_cpu_threads?: number;
  cores?: number;
  capabilities?: string[];
};

export class Constraints {
  inner!: string[];

  constructor() {
    this.inner = [];
  }

  extend(items: string[]) {
    this.inner.push(...items);
  }

  toString(): string {
    return `(&${this.inner.join("\n\t")})`;
  }
}

// Information on task package to be used for running tasks on providers.
export class Package {
  async resolve_url(self): Promise<void | string> {
    // Return package URL.
  }

  async decorate_demand(demand: DemandBuilder) {
    // Add package information to a Demand.
  }
}

export class VMManifestPackage extends Package {
  manifest: string;
  manifest_sig?: string;
  manifest_sig_algorithm?: string;
  manifest_cert?: string;
  constraints!: Constraints;

  constructor({ manifest, manifest_sig, manifest_sig_algorithm, manifest_cert, constraints }) {
    super();
    this.manifest = manifest;
    this.manifest_sig = manifest_sig;
    this.manifest_sig_algorithm = manifest_sig_algorithm;
    this.manifest_cert = manifest_cert;
    this.constraints = constraints;
  }

  async resolve_url(): Promise<string> {
    return "";
  }

  async decorate_demand(demand: DemandBuilder) {
    demand.ensure(this.constraints.toString());
    demand.add(
      new VmManifestRequest({
        manifest: this.manifest,
        manifest_sig: this.manifest_sig,
        manifest_sig_algorithm: this.manifest_sig_algorithm,
        manifest_cert: this.manifest_cert,
        package_format: VmPackageFormat.GVMKIT_SQUASH,
      })
    );
  }
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
    const resp = await axios.get(`${this.repo_url}/image.${this.image_hash}.link`);
    if (resp.status != 200) throw Error(`Error: ${resp.status}`);

    const image_url = await resp.data;
    const image_hash = this.image_hash;
    return `hash:sha3:${image_hash}:${image_url}`;
  }

  async decorate_demand(demand: DemandBuilder) {
    const image_url = await this.resolve_url();
    demand.ensure(this.constraints.toString());
    demand.add(new VmRequest(image_url, VmPackageFormat.GVMKIT_SQUASH));
  }
}

export const resolve_repo_srv = async ({ repo_srv, fallback_url = FALLBACK_REPO_URL }) => {
  async function _resolve_repo_srv() {
    return new Promise((resolve, reject) => {
      const verify_records = async function (err, records) {
        if (!(Symbol.iterator in Object(records))) {
          resolve(null);
          return;
        }
        for (const record of records) {
          const url = `http://${record.name}:${record.port}`;
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
