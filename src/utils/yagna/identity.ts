// TODO: replace with a proper REST API client once ya-client and ya-ts-client are updated
// https://github.com/golemfactory/golem-js/issues/290
import { BaseAPI } from "ya-ts-client/dist/ya-net/base";
import { GolemInternalError } from "../../error/golem-error";

export interface IdentityModel {
  identity: string;
  name: string;
  role: string;
}

interface IdentityRequestorApi {
  getIdentity(): Promise<IdentityModel>;
}

export class RequestorApi extends BaseAPI implements IdentityRequestorApi {
  async getIdentity(): Promise<IdentityModel> {
    const res = await fetch(this.basePath + "/me", {
      headers: { authorization: `Bearer ${this.configuration?.apiKey}` },
    });

    if (!res.ok) {
      throw new GolemInternalError(`Failed to get identity: ${res.statusText}`);
    }

    return await res.json();
  }
}
