import { ComparisonOperator, DecorationsBuilder, MarketDecoration } from "../market/builder.js";
import { EnvUtils, Logger } from "../utils/index.js";
import axios from "axios";
import { PackageConfig } from "./config.js";
import { RequireAtLeastOne } from "../types/RequireAtLeastOne.js";
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
    imageHash: string;
    /**  finds package by registry tag  */

    imageTag: string;
    manifest: string;
    /** Signature of base64 encoded Computation Payload Manifest **/
    manifestSig?: string;
    /** Algorithm of manifest signature, e.g. "sha256" **/
    manifestSigAlgorithm?: string;
    /** Certificate - base64 encoded public certificate (DER or PEM) matching key used to generate signature **/
    manifestCert?: string;
    logger?: Logger;
  },
  "imageHash" | "imageTag" | "manifest"
>;

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
    // ? : Dependency Injection could be useful
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

  private async resolveTaskPackageUrl(): Promise<string> {
    const repoUrl = EnvUtils.getRepoUrl();

    //TODO : in future this should be passed probably through config

    const isHttps = process.env.YAJSAPI_USE_HTTPS_LINK ?? false;

    // ? Should we prefix all env variables with YAJSAPI_ or not?
    // with YAJSAPI we stay consistent but GOLEM is more general and can be used
    // for other projects as well (yapapi e.g. )

    const isDev = process.env.GOLEM_DEV_MODE;

    let hash = this.options.imageHash;
    const tag = this.options.imageTag;

    const url = `${repoUrl}/v1/image/info?${isDev ? "dev=true" : "count=true"}&${tag ? `tag=${tag}` : `hash=${hash}`}`;

    const response = await axios.get(url, {
      //always give reponse instead of throwing error
      // ? this should probably go to general config
      validateStatus: () => true,
    });
    if (response.status != 200) {
      this.logger?.error(`Unable to get image Url of  ${tag || hash} from ${repoUrl}`);
      throw Error(`${response.data}`);
    }
    const imageUrl = isHttps ? response.data.https : response.data.http;
    hash = response.data.sha3;
    return `hash:sha3:${hash}:${imageUrl}`;
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
