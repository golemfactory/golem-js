import { ComparisonOperator, DecorationsBuilder, MarketDecoration } from "../market/builder.js";
import { RepoResolver } from "./repo_resolver.js";
import { Logger } from "../utils/index.js";
import axios from "axios";
import { PackageConfig } from "./config.js";
import { RequireAtLeastOne, RequireExactlyOne } from "type-fest";
/**
 * @category Mid-level
 */

export type PackageOptions = RequireAtLeastOne<
  {
    /** Type of engine required: vm, emscripten, sgx, sgx-js, sgx-wasm, sgx-wasi */
    engine?: string;
    /** Minimum required memory to execute application GB */
    minMemGib?: number;
    /** Minimum required disk storage to execute tasks in GB */
    minStorageGib?: number;
    /** Minimum required CPU threads */
    minCpuThreads?: number;
    /** Minimum required CPU cores */
    minCpuCores?: number;
    /** Required providers capabilities to run application */
    capabilities?: string[];
    /**  finds package by its contents hash */
    imageHash?: string;
    imageTag?: string;
    repoUrl?: string;
    logger?: Logger;
  },
  "imageHash" | "imageTag"
>;
/**
 * Package module - an object for descriptions of the payload required by the requestor.
 * @category Mid-level
 */
export class Package {
  private logger?: Logger;

  private constructor(private options: PackageConfig) {
    this.logger = options.logger;
  }

  static create(options: PackageOptions): Package {
    const config = new PackageConfig(options);
    return new Package(config);
  }

  static getImageIdentifier(
    str: string
  ): RequireAtLeastOne<{ imageHash: string; imageTag: string }, "imageHash" | "imageTag"> {
    const tagRegex = /^(.*?)\/(.*?):(.*)$/;
    if (tagRegex.test(str)) {
      return {
        imageTag: str,
      };
    }

    return {
      imageHash: str,
    };
  }

  static GetHashFromTag(tag: string): string {
    return tag.split(":")[1];
  }

  async getDemandDecoration(): Promise<MarketDecoration> {
    const taskPackage = await this.resolveTaskPackageUrl();
    const builder = new DecorationsBuilder();
    builder
      .addProperty("golem.srv.comp.task_package", taskPackage)
      .addProperty("golem.srv.comp.vm.package_format", this.options.packageFormat)
      .addConstraint("golem.inf.mem.gib", this.options.minMemGib.toString(), ComparisonOperator.GtEq)
      .addConstraint("golem.inf.storage.gib", this.options.minStorageGib.toString(), ComparisonOperator.GtEq)
      .addConstraint("golem.runtime.name", this.options.engine)
      // .addConstraint("golem.inf.cpu.cores", this.options.minCpuCores.toString(), ComparisonOperator.GtEq)
      .addConstraint("golem.inf.cpu.threads", this.options.minCpuThreads.toString(), ComparisonOperator.GtEq);
    if (this.options.capabilities.length)
      builder.addConstraint("golem.runtime.capabilities", this.options.capabilities.join(","));
    return builder.getDecorations();
  }

  private async getRepoUrl(): Promise<string> {
    if (this.options.repoUrl) {
      return this.options.repoUrl;
    }
    const repoResolver = RepoResolver.create({ logger: this.logger });
    const repoURL = await repoResolver.getRepoUrl();
    return repoURL;
  }

  private async resolveTaskPackageUrl(): Promise<string> {
    const repoUrl = await this.getRepoUrl();

    //TODO : in future this should be argument on getImageProviderLink

    const isHttps = process.env.YAJSAPI_USE_HTTPS_LINK ?? false;
    const isDev = process.env.GOLEM_DEV_MODE;

    const hash = this.options.imageHash;
    const tag = this.options.imageTag;
    const url = `${repoUrl}/v1/image/info?${isDev ? "dev=true" : ""}${tag ? `tag=${tag}` : `hash=${hash}`}`;

    const response = await axios.get(url);
    if (response.status != 200) {
      this.logger?.error(`Unable to resolve package hash from tag: Response ` + response.status);
      throw Error(`Error: ${response.status}`);
    }

    const imageUrl = isHttps ? response.data.https : response.data.http;
    return `hash:sha3:${hash}:${imageUrl}`;
  }
}
