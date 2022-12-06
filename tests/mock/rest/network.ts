/* eslint @typescript-eslint/ban-ts-comment: 0 */
import { RequestorApi } from "ya-ts-client/dist/ya-net/src/api/requestor-api";
import { v4 as uuidv4 } from "uuid";
import { Address, Network, Node } from "ya-ts-client/dist/ya-net/src/models";
import { AxiosRequestConfig, AxiosResponse } from "axios";

let error;
export const setExpectedError = (e) => (error = e);
export const clear = () => {
  error = null;
};

export class NetworkApiMock extends RequestorApi {
  constructor() {
    super();
  }
  // @ts-ignore
  createNetwork(network: Network, options?: AxiosRequestConfig): Promise<import("axios").AxiosResponse<Network>> {
    return new Promise((res) =>
      res({ data: { id: uuidv4(), ip: "192.168.0.0", mask: "255.255.255.0" } } as AxiosResponse)
    );
  }
  // @ts-ignore
  removeNetwork(networkId: string, options?: AxiosRequestConfig): Promise<import("axios").AxiosResponse<void>> {
    if (error) return Promise.reject(error);
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
