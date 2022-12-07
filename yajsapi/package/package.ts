import axios from "axios";
import { runtimeContextChecker, Logger } from "../utils";
import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";
import { DecorationsBuilder } from "../market/decorations_builder";

interface PackageOptions {
  image_hash: string;
  repo_url?: string;
  logger?: Logger;
}

export enum PackageFormat {
  UNKNOWN = "",
  GVMKIT_SQUASH = "gvmkit-squash",
}

export class Package {
  private FALLBACK_REPO_URL = "http://girepo.dev.golem.network:8000";
  private PUBLIC_DNS_URL = "https://dns.google/resolve?type=srv&name=";
  private DEFAULT_REPO_SRV = "_girepo._tcp.dev.golem.network";
  private SCHEMA = "http";

  private package_format: PackageFormat = PackageFormat.GVMKIT_SQUASH;

  private constructor(private image_hash: string, private repo_url?: string, private logger?: Logger) {}

  static create(packageOptions: PackageOptions): Package {
    const { image_hash, repo_url, logger } = packageOptions;
    return new Package(image_hash, repo_url, logger);
  }

  private async isRecordValid(url) {
    try {
      await axios.head(url);
      return true;
    } catch (e) {
      return false;
    }
  }

  private async resolveRepoUrl() {
    try {
      const records = runtimeContextChecker.isBrowser
        ? await this.resolveRepoSrvForBrowser()
        : await this.resolveRepoSrvForNode();

      while (records.length > 0) {
        const url = records.splice((records.length * Math.random()) | 0, 1)[0];
        if (await this.isRecordValid(url)) {
          return url;
        }
      }
    } catch (e) {
      this.logger?.warn(`error occurred while trying to get SRV record : ${e}`);
    }
    return null;
  }

  private async getRepoUrl() {
    if (this.repo_url) {
      return this.repo_url;
    }
    const repoUrl = await this.resolveRepoUrl();
    if (repoUrl) {
      this.logger?.debug(`Using image repository: ${repoUrl}.`);
      return repoUrl;
    }
    this.logger?.warn(
      `Problem resolving image repository: ${this.DEFAULT_REPO_SRV}, falling back to ${this.FALLBACK_REPO_URL}.`
    );
    return this.FALLBACK_REPO_URL;
  }

  private async resolveRepoSrvForBrowser() {
    const { data } = await axios.get(`${this.PUBLIC_DNS_URL}${this.DEFAULT_REPO_SRV}`);

    return (data?.Answer || [])
      .map((r) => {
        const [, , port, host] = r && r.data && r.data.split ? r.data.split(" ") : [];
        return host && port ? `${this.SCHEMA}://${host.substring(0, host.length - 1)}:${port}` : null;
      })
      .filter((r) => r);
  }

  private async resolveRepoSrvForNode() {
    return new Promise((resolve, reject) => {
      import("node:dns")
        .then((nodeDns) => {
          nodeDns.resolveSrv(this.DEFAULT_REPO_SRV, (err, addresses) => {
            if (err) reject(err);
            resolve(addresses.map((a) => (a.name && a.port ? `${this.SCHEMA}://${a.name}:${a.port}` : null)));
          });
        })
        .catch((err) => reject(err));
    });
  }

  async resolveTaskPackageUrl(): Promise<string> {
    const repoUrl = this.getRepoUrl();
    const response = await axios.get(`${repoUrl}/image.${this.image_hash}.link`);
    if (response.status != 200) {
      this.logger?.error(`Unable to resolve task package url: Response ` + response.status);
      throw Error(`Error: ${response.status}`);
    }

    const image_url = await response.data;
    return `hash:sha3:${this.image_hash}:${image_url}`;
  }

  async getDemandDecoration(): Promise<MarketDecoration> {
    const taskPackage = await this.resolveTaskPackageUrl();

    const builder = new DecorationsBuilder();
    return builder
      .addProperty("golem.srv.comp.task_package", taskPackage)
      .addProperty("golem.srv.comp.vm.package_format", this.package_format)
      .getDecorations();
  }
}
