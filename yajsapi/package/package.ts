import { ComparisonOperator, DecorationsBuilder, MarketDecoration } from "../market/builder";
import { RepoResolver } from "./repo_resolver";
import { Logger } from "../utils";
import axios from "axios";
import { PackageConfig } from "./config";

export interface PackageOptions {
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
  imageHash: string;
  repoUrl?: string;
  logger?: Logger;
}

/**
 * Package
 *
 * @description represents package for computation. Includes image hash, and requirements for computation like min memory, cpu, storage capabilities etc.
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
    return await repoResolver.getRepoUrl();
  }

  private async resolveTaskPackageUrl(): Promise<string> {
    const repoUrl = await this.getRepoUrl();
    const response = await axios.get(`${repoUrl}/image.${this.options.imageHash}.link`);
    if (response.status != 200) {
      this.logger?.error(`Unable to resolve task package url: Response ` + response.status);
      throw Error(`Error: ${response.status}`);
    }

    const imageUrl = await response.data;
    return `hash:sha3:${this.options.imageHash}:${imageUrl}`;
  }
}
