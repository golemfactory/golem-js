// TODO: replace with a proper REST API client once ya-client and ya-ts-client are updated
import { BaseAPI } from "ya-ts-client/dist/ya-net/base";
import { GolemError } from "../../error/golem-error";

export type ServiceModel = {
  servicesId: string;
};

export type GftpFileInfo = {
  id: string;
  url: string;
};

interface GsbRequestorApi {
  createService(fileInfo: GftpFileInfo, components: string[]): Promise<ServiceModel>;

  deleteService(id: string): Promise<void>;
}

export class RequestorApi extends BaseAPI implements GsbRequestorApi {
  async createService(fileInfo: GftpFileInfo, components: string[]): Promise<ServiceModel> {
    const response = await fetch(`${this.basePath}/services`, {
      method: "POST",
      body: JSON.stringify({
        listen: {
          on: `/public/gftp/${fileInfo.id}`,
          components,
        },
      }),
      headers: {
        "Content-Type": "application/json",
        authorization: `Bearer ${this.configuration?.apiKey}`,
      },
    }).catch((e) => {
      throw new GolemError(`Failed to create service: ${e}`);
    });

    if (!response.ok) {
      throw new GolemError(`Failed to create service: ${response.statusText}`);
    }

    return await response.json();
  }

  async deleteService(id: string): Promise<void> {
    const response = await fetch(`${this.basePath}/services/${id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${this.configuration?.apiKey}` },
    }).catch((e) => {
      throw new GolemError(`Failed to delete service: ${e}`);
    });

    if (!response.ok) {
      throw new GolemError(`Failed to delete service: ${response.statusText}`);
    }
  }
}
