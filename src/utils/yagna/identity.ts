// TODO: replace with a proper REST API client once ya-client and ya-ts-client are updated
// https://github.com/golemfactory/golem-js/issues/290

import * as YaTsClient from "ya-ts-client";

export interface IdentityModel {
  identity: string;
  name: string;
  role: string;
}

interface IIdentityRequestorApi {
  getIdentity(): Promise<IdentityModel>;
}

export class IdentityRequestorApi implements IIdentityRequestorApi {
  constructor(public readonly httpRequest: YaTsClient.MarketApi.BaseHttpRequest) {}

  async getIdentity(): Promise<IdentityModel> {
    return this.httpRequest.request({
      method: "GET",
      url: "/me",
    });
  }
}
