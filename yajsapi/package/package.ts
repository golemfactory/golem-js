import { MarketDecoration } from "ya-ts-client/dist/ya-payment/src/models";
import { DecorationsBuilder } from "../market/decorations_builder";
import { RepoResolver } from "./repo_resolver";
import { Logger } from "../utils";
import axios from "axios";

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
  private package_format: PackageFormat = PackageFormat.GVMKIT_SQUASH;

  private constructor(private image_hash: string, private repo_url?: string, private logger?: Logger) {}

  static create(packageOptions: PackageOptions): Package {
    const { image_hash, repo_url, logger } = packageOptions;
    return new Package(image_hash, repo_url, logger);
  }

  async getDemandDecoration(): Promise<MarketDecoration> {
    const taskPackage = await this.resolveTaskPackageUrl();

    const builder = new DecorationsBuilder();
    return builder
      .addProperty("golem.srv.comp.task_package", taskPackage)
      .addProperty("golem.srv.comp.vm.package_format", this.package_format)
      .getDecorations();
  }

  private async getRepoUrl(): Promise<string> {
    if (this.repo_url) {
      return this.repo_url;
    }
    const repoResolver = RepoResolver.create({ logger: this.logger });
    return await repoResolver.getRepoUrl();
  }

  private async resolveTaskPackageUrl(): Promise<string> {
    const repoUrl = await this.getRepoUrl();
    const response = await axios.get(`${repoUrl}/image.${this.image_hash}.link`);
    if (response.status != 200) {
      this.logger?.error(`Unable to resolve task package url: Response ` + response.status);
      throw Error(`Error: ${response.status}`);
    }

    const image_url = await response.data;
    return `hash:sha3:${this.image_hash}:${image_url}`;
  }
}
