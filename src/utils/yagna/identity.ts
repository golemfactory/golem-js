// TODO: replace with a proper REST API client once ya-client and ya-ts-client are updated
// https://github.com/golemfactory/golem-js/issues/290
import { AxiosPromise, AxiosRequestConfig, AxiosResponse } from "axios";
import { BaseAPI } from "ya-ts-client/dist/ya-net/base";
export interface IdentityModel {
  identity: string;
  name: string;
  role: string;
}

interface IdentityRequestorApi {
  getIdentity(options?: AxiosRequestConfig): AxiosPromise<IdentityModel>;
}

export class RequestorApi extends BaseAPI implements IdentityRequestorApi {
  async getIdentity(): Promise<AxiosResponse<IdentityModel>> {
    return this.axios.get(this.basePath + "/me", {
      headers: { authorization: `Bearer ${this.configuration?.apiKey}` },
    });
  }
}
