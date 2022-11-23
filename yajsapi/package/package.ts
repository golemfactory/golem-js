import axios from "axios";
import { DemandBuilder } from "../props";
import { VmPackageFormat, VmRequest } from "../props/inf";
import { runtimeContextChecker, dayjs } from "../utils";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";
import { MarketProperty } from "ya-ts-client/dist/ya-payment/src/models/market-property";

const FALLBACK_REPO_URL = "http://girepo.dev.golem.network:8000";
const PUBLIC_DNS_URL = "https://dns.google/resolve?type=srv&name=";
export const DEFAULT_REPO_SRV = "_girepo._tcp.dev.golem.network";
const SCHEMA = "http";

export type RepoOpts = {
  engine?: string;
  image_hash: string;
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
  async getDemandDecoration(): Promise<MarketDecoration> {
    // TMP: the same as decorate demand
    return {} as MarketDecoration;
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

  // async decorate_demand(demand: DemandBuilder) {
  //   const image_url = await this.resolve_url();
  //   demand.ensure(this.constraints.toString());
  //   demand.add(new VmRequest(image_url, VmPackageFormat.GVMKIT_SQUASH));
  // }

  async getDemandDecoration(): Promise<MarketDecoration> {
    const imageUrl = await this.resolve_url();
    const VmRequestProp = new VmRequest(imageUrl, VmPackageFormat.GVMKIT_SQUASH);
    return {
      constraints: [this.constraints.toString()],
      properties: VmRequestProp.properties(),
    };
  }
}

export const resolve_repo_srv = async ({ repo_srv, fallback_url = FALLBACK_REPO_URL, logger }) => {
  async function is_record_valid(url) {
    try {
      await axios.head(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function _resolve_repo_srv_for_browser() {
    const { data } = await axios.get(`${PUBLIC_DNS_URL}${repo_srv}`);

    return (data?.Answer || [])
      .map((r) => {
        const [, , port, host] = r && r.data && r.data.split ? r.data.split(" ") : [];
        return host && port ? `${SCHEMA}://${host.substring(0, host.length - 1)}:${port}` : null;
      })
      .filter((r) => r);
  }

  function _resolve_repo_srv_for_node() {
    return new Promise((resolve, reject) => {
      import("node:dns")
        .then((nodeDns) => {
          nodeDns.resolveSrv(DEFAULT_REPO_SRV, (err, addresses) => {
            if (err) reject(err);
            resolve(addresses.map((a) => (a.name && a.port ? `${SCHEMA}://${a.name}:${a.port}` : null)));
          });
        })
        .catch((err) => reject(err));
    });
  }

  async function _resolve_repo_srv() {
    try {
      const records = runtimeContextChecker.isBrowser
        ? await _resolve_repo_srv_for_browser()
        : await _resolve_repo_srv_for_node();

      while (records.length > 0) {
        const url = records.splice((records.length * Math.random()) | 0, 1)[0];
        if (await is_record_valid(url)) {
          return url;
        }
      }
    } catch (e) {
      logger?.warn(`error occurred while trying to get SRV record : ${e}`);
    }

    return null;
  }

  const repo_url = await _resolve_repo_srv();
  if (repo_url) {
    logger?.debug(`Using image repository: ${repo_srv} -> ${repo_url}.`);
    return repo_url;
  }
  logger?.warn(`Problem resolving image repository: ${repo_srv}, falling back to ${fallback_url}.`);
  return fallback_url;
};
