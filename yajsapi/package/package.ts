import { ComparisonOperator, DecorationsBuilder, MarketDecoration } from "../market/builder.js";
import { RepoResolver } from "./repo_resolver.js";
import { Logger } from "../utils/index.js";
import axios from "axios";
import { PackageConfig } from "./config.js";

/**
 * @category Mid-level
 */
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
  imageHash?: string;
  /** The address of the repository where the images are shared **/
  repoUrl?: string;
  /** Manifest - base64 encoded Computation Payload Manifest
   https://handbook.golem.network/requestor-tutorials/vm-runtime/computation-payload-manifest **/
  manifest?: string;
  /** Signature of base64 encoded Computation Payload Manifest **/
  manifestSig?: string;
  /** Algorithm of manifest signature, e.g. "sha256" **/
  manifestSigAlgorithm?: string;
  /** Certificate - base64 encoded public certificate (DER or PEM) matching key used to generate signature **/
  manifestCert?: string;
  /** Custom logger **/
  logger?: Logger;
}

export interface PackageDetails {
  minMemGib: number;
  minStorageGib: number;
  minCpuThreads: number;
  minCpuCores: number;
  engine: string;
  capabilities: string[];
  imageHash?: string;
}

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

  async getDemandDecoration(): Promise<MarketDecoration> {
    const builder = new DecorationsBuilder();
    builder
      .addProperty("golem.srv.comp.vm.package_format", this.options.packageFormat)
      .addConstraint("golem.inf.mem.gib", this.options.minMemGib.toString(), ComparisonOperator.GtEq)
      .addConstraint("golem.inf.storage.gib", this.options.minStorageGib.toString(), ComparisonOperator.GtEq)
      .addConstraint("golem.runtime.name", this.options.engine)
      .addConstraint("golem.inf.cpu.cores", this.options.minCpuCores.toString(), ComparisonOperator.GtEq)
      .addConstraint("golem.inf.cpu.threads", this.options.minCpuThreads.toString(), ComparisonOperator.GtEq);
    if (this.options.imageHash) {
      const taskPackage = await this.resolveTaskPackageUrl();
      builder.addProperty("golem.srv.comp.task_package", taskPackage);
    }
    if (this.options.capabilities.length)
      this.options.capabilities.forEach((cap) => builder.addConstraint("golem.runtime.capabilities", cap));
    this.addManifestDecorations(builder);
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

  private addManifestDecorations(builder: DecorationsBuilder): void {
    if (!this.options.manifest) return;
    builder.addProperty("golem.srv.comp.payload", this.options.manifest);
    if (this.options.manifestSig) builder.addProperty("golem.srv.comp.payload.sig", this.options.manifestSig);
    if (this.options.manifestSigAlgorithm)
      builder.addProperty("golem.srv.comp.payload.sig.algorithm", this.options.manifestSigAlgorithm);
    if (this.options.manifestCert) builder.addProperty("golem.srv.comp.payload.cert", this.options.manifestCert);
  }

  get details(): PackageDetails {
    return {
      minMemGib: this.options.minMemGib,
      minStorageGib: this.options.minStorageGib,
      minCpuThreads: this.options.minCpuThreads,
      minCpuCores: this.options.minCpuCores,
      engine: this.options.engine,
      capabilities: this.options.capabilities,
      imageHash: this.options.imageHash,
    };
  }
}
