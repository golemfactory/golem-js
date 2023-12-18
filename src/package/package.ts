import { ComparisonOperator, DecorationsBuilder, MarketDecoration } from "../market/builder";
import { EnvUtils, Logger } from "../utils";
import { PackageConfig } from "./config";
import { RequireAtLeastOne } from "../utils/types";
import { GolemError } from "../error/golem-error";

export type AllPackageOptions = {
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
  /**  finds package by registry tag  */
  imageTag?: string;
  manifest?: string;
  /** Signature of base64 encoded Computation Payload Manifest **/
  manifestSig?: string;
  /** Algorithm of manifest signature, e.g. "sha256" **/
  manifestSigAlgorithm?: string;
  /** Certificate - base64 encoded public certificate (DER or PEM) matching key used to generate signature **/
  manifestCert?: string;
  logger?: Logger;
};

export type PackageOptions = RequireAtLeastOne<AllPackageOptions, "imageHash" | "imageTag" | "manifest">;

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
 */
export class Package {
  private logger?: Logger;

  private constructor(private options: PackageConfig) {
    this.logger = options.logger;
  }

  static create(options: PackageOptions): Package {
    // ? : Dependency Injection could be useful
    const config = new PackageConfig(options);
    return new Package(config);
  }

  static getImageIdentifier(
    str: string,
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

  async getDemandDecoration(): Promise<MarketDecoration> {
    const builder = new DecorationsBuilder();
    builder
      .addProperty("golem.srv.comp.vm.package_format", this.options.packageFormat)
      .addConstraint("golem.inf.mem.gib", this.options.minMemGib.toString(), ComparisonOperator.GtEq)
      .addConstraint("golem.inf.storage.gib", this.options.minStorageGib.toString(), ComparisonOperator.GtEq)
      .addConstraint("golem.runtime.name", this.options.engine)
      .addConstraint("golem.inf.cpu.cores", this.options.minCpuCores.toString(), ComparisonOperator.GtEq)
      .addConstraint("golem.inf.cpu.threads", this.options.minCpuThreads.toString(), ComparisonOperator.GtEq);
    if (this.options.imageHash || this.options.imageTag) {
      const taskPackage = await this.resolveTaskPackageUrl();
      builder.addProperty("golem.srv.comp.task_package", taskPackage);
    }
    if (this.options.capabilities.length)
      this.options.capabilities.forEach((cap) => builder.addConstraint("golem.runtime.capabilities", cap));
    this.addManifestDecorations(builder);
    return builder.getDecorations();
  }

  private async resolveTaskPackageUrl(): Promise<string> {
    const repoUrl = EnvUtils.getRepoUrl();

    //TODO : in future this should be passed probably through config
    const isHttps = false;

    const isDev = EnvUtils.isDevMode();

    let hash = this.options.imageHash;
    const tag = this.options.imageTag;

    const url = `${repoUrl}/v1/image/info?${isDev ? "dev=true" : "count=true"}&${tag ? `tag=${tag}` : `hash=${hash}`}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        this.logger?.error(`Unable to get image Url of  ${tag || hash} from ${repoUrl}`);
        throw new GolemError(await response.text());
      }

      const data = await response.json();

      const imageUrl = isHttps ? data.https : data.http;
      hash = data.sha3;

      return `hash:sha3:${hash}:${imageUrl}`;
    } catch (error) {
      if (error instanceof GolemError) throw error;

      this.logger?.error(`Unable to get image Url of  ${tag || hash} from ${repoUrl}`);
      throw new GolemError(`Failed to fetch image: ${error}`);
    }
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
