/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorApi } from "ya-ts-client/dist/ya-net/src/api/requestor-api.js";
import { v4 as uuidv4 } from "uuid";
import { Address, Network, Node } from "ya-ts-client/dist/ya-net/src/models/index.js";
import { AxiosRequestConfig, AxiosResponse } from "axios";

export class NetworkApiMock extends RequestorApi {
  error;
  constructor() {
    super();
  }
  setExpectedError(e) {
    this.error = e;
  }
  // @ts-ignore
  createNetwork(network: Network, options?: AxiosRequestConfig): Promise<import("axios").AxiosResponse<Network>> {
    return new Promise((res) =>
      res({ data: { id: uuidv4(), ip: "192.168.0.0", mask: "255.255.255.0" } } as AxiosResponse)
    );
  }
  // @ts-ignore
  removeNetwork(networkId: string, options?: AxiosRequestConfig): Promise<import("axios").AxiosResponse<void>> {
    if (this.error) return Promise.reject(this.error);
    return new Promise((res) => res({ data: undefined } as AxiosResponse));
  }
  // @ts-ignore
  addAddress(
    networkId: string,
    address: Address,
    options?: AxiosRequestConfig
  ): Promise<import("axios").AxiosResponse<void>> {
    return new Promise((res) => res({ data: undefined } as AxiosResponse));
  }
  // @ts-ignore
  addNode(networkId: string, node: Node, options?: AxiosRequestConfig): Promise<import("axios").AxiosResponse<void>> {
    return new Promise((res) => res({ data: undefined } as AxiosResponse));
  }
}
