// TODO: replace with a proper REST API client once ya-client and ya-ts-client are updated
import { AxiosPromise, AxiosRequestConfig, AxiosResponse } from "axios";
import { BaseAPI } from "ya-ts-client/dist/ya-net/base";

export type ServiceModel = {
  serviceId: string;
};

export type GftpFileInfo = {
  id: string;
  url: string;
};

interface GsbRequestorApi {
  createService(fileInfo: GftpFileInfo, components: string[], options?: AxiosRequestConfig): AxiosPromise<ServiceModel>;
  deleteService(id: string, options?: AxiosRequestConfig): AxiosPromise<void>;
}

export class RequestorApi extends BaseAPI implements GsbRequestorApi {
  async createService(fileInfo: GftpFileInfo, components: string[]): Promise<AxiosResponse<ServiceModel>> {
    return this.axios.post(
      `${this.basePath}/services`,
      {
        listen: {
          on: `/public/gftp/${fileInfo.id}`,
          components,
        },
      },
      {
        headers: { authorization: `Bearer ${this.configuration?.apiKey}` },
      },
    );
  }

  async deleteService(id: string): Promise<AxiosResponse<void>> {
    return this.axios.delete(`${this.basePath}/services/${id}`, {
      headers: { authorization: `Bearer ${this.configuration?.apiKey}` },
    });
  }
}
