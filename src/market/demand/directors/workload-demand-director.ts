import { WorkloadDemandDirectorConfig } from "./workload-demand-director-config";
import { ComparisonOperator, DemandDetailsBuilder } from "../demand-details-builder";
import { GolemError, GolemPlatformError } from "../../../shared/error/golem-error";
import { IDemandDirector } from "../../market.module";
import { EnvUtils } from "../../../shared/utils";

export class WorkloadDemandDirector implements IDemandDirector {
  constructor(private config: WorkloadDemandDirectorConfig) {}

  public async apply(builder: DemandDetailsBuilder) {
    builder
      .addProperty("golem.srv.comp.vm.package_format", this.config.packageFormat)
      .addConstraint("golem.runtime.name", this.config.engine);

    if (this.config.capabilities.length)
      this.config.capabilities.forEach((cap) => builder.addConstraint("golem.runtime.capabilities", cap));

    builder
      .addConstraint("golem.inf.mem.gib", this.config.minMemGib, ComparisonOperator.GtEq)
      .addConstraint("golem.inf.storage.gib", this.config.minStorageGib, ComparisonOperator.GtEq)
      .addConstraint("golem.inf.cpu.cores", this.config.minCpuCores, ComparisonOperator.GtEq)
      .addConstraint("golem.inf.cpu.threads", this.config.minCpuThreads, ComparisonOperator.GtEq);

    if (this.config.imageUrl) {
      const taskPackage = await this.resolveTaskPackageFromCustomUrl();
      builder.addProperty("golem.srv.comp.task_package", taskPackage);
    } else if (this.config.imageHash || this.config.imageTag) {
      const taskPackage = await this.resolveTaskPackageUrl();
      builder.addProperty("golem.srv.comp.task_package", taskPackage);
    }

    this.addManifestDecorations(builder);
  }

  private async resolveTaskPackageFromCustomUrl(): Promise<string> {
    if (!this.config.imageUrl) {
      throw new GolemPlatformError("Tried to resolve task package from custom url, but no url was provided");
    }
    if (!this.config.imageHash) {
      throw new GolemPlatformError(
        "Tried to resolve task package from custom url, but no hash was provided. Please calculate the SHA3-224 hash of the image and provide it as `imageHash`",
      );
    }
    return `hash:sha3:${this.config.imageHash}:${this.config.imageUrl}`;
  }

  private async resolveTaskPackageUrl(): Promise<string> {
    const repoUrl = EnvUtils.getRepoUrl();

    //TODO : in future this should be passed probably through config
    const isHttps = false;

    const isDev = EnvUtils.isDevMode();

    let hash = this.config.imageHash;
    const tag = this.config.imageTag;

    const url = `${repoUrl}/v1/image/info?${isDev ? "dev=true" : "count=true"}&${tag ? `tag=${tag}` : `hash=${hash}`}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new GolemPlatformError(`Unable to get image ${await response.text()}`);
      }

      const data = await response.json();

      const imageUrl = isHttps ? data.https : data.http;
      hash = data.sha3;

      return `hash:sha3:${hash}:${imageUrl}`;
    } catch (error) {
      if (error instanceof GolemError) throw error;
      throw new GolemPlatformError(`Failed to fetch image: ${error}`);
    }
  }

  private addManifestDecorations(builder: DemandDetailsBuilder): void {
    if (!this.config.manifest) return;
    builder.addProperty("golem.srv.comp.payload", this.config.manifest);
    if (this.config.manifestSig) builder.addProperty("golem.srv.comp.payload.sig", this.config.manifestSig);
    if (this.config.manifestSigAlgorithm)
      builder.addProperty("golem.srv.comp.payload.sig.algorithm", this.config.manifestSigAlgorithm);
    if (this.config.manifestCert) builder.addProperty("golem.srv.comp.payload.cert", this.config.manifestCert);
  }
}
