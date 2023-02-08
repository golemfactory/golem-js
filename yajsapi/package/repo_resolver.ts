import axios from "axios";
import { Logger, runtimeContextChecker } from "../utils/index.js";

const FALLBACK_REPO_URL = "http://girepo.dev.golem.network:8000";
const PUBLIC_DNS_URL = "https://dns.google/resolve?type=srv&name=";
const DEFAULT_REPO_SRV = "_girepo._tcp.dev.golem.network";
const SCHEMA = "http";
const TIMEOUT = 10000;

/**
 * @internal
 */
export interface RepoResolverOptions {
  logger?: Logger;
}

/**
 * @internal
 */
export class RepoResolver {
  private constructor(private logger?: Logger) {}

  static create({ logger }: RepoResolverOptions): RepoResolver {
    return new RepoResolver(logger);
  }
  private async isRecordValid(url) {
    try {
      await axios.head(url, { timeout: TIMEOUT });
      return true;
    } catch (e) {
      if (e?.response?.status > 200 && e?.response?.status < 500) return true;
      this.logger?.warn(`Url ${url} is not responding. ${e?.message}`);
      return false;
    }
  }

  async resolveRepoUrl() {
    try {
      const records = runtimeContextChecker.isBrowser
        ? await this.resolveRepoUrlForBrowser()
        : await this.resolveRepoUrlForNode();

      while (records.length > 0) {
        const url = records.splice((records.length * Math.random()) | 0, 1)[0];
        if (await this.isRecordValid(url)) {
          return url;
        }
      }
    } catch (e) {
      this.logger?.warn(`Error occurred while trying to get SRV record : ${e}`);
    }
    return null;
  }

  async getRepoUrl() {
    const repoUrl = await this.resolveRepoUrl();
    if (repoUrl) {
      this.logger?.debug(`Using image repository: ${repoUrl}.`);
      return repoUrl;
    }
    this.logger?.warn(`Problem resolving image repository: ${DEFAULT_REPO_SRV}, falling back to ${FALLBACK_REPO_URL}.`);
    return FALLBACK_REPO_URL;
  }

  private async resolveRepoUrlForBrowser() {
    const { data } = await axios.get(`${PUBLIC_DNS_URL}${DEFAULT_REPO_SRV}`, { timeout: 5000 });

    return (data?.Answer || [])
      .map((r) => {
        const [, , port, host] = r && r.data && r.data.split ? r.data.split(" ") : [];
        return host && port ? `${SCHEMA}://${host.substring(0, host.length - 1)}:${port}` : null;
      })
      .filter((r) => r);
  }

  private async resolveRepoUrlForNode() {
    return new Promise((resolve, reject) => {
      import("node:dns")
        .then((nodeDns) => {
          nodeDns.resolveSrv(DEFAULT_REPO_SRV, (err, addresses) => {
            if (err) reject(err);
            resolve(addresses?.map((a) => (a.name && a.port ? `${SCHEMA}://${a.name}:${a.port}` : null)));
          });
        })
        .catch((err) => reject(err));
    });
  }
}
