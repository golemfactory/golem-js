import { NetworkNode, NetworkService } from "../../../src/network";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
export const networkServiceMock: NetworkService = {
  async addNode(nodeId: string, ip?: string): Promise<NetworkNode> {
    return Promise.resolve({} as NetworkNode);
  },
  async end(): Promise<void> {
    return Promise.resolve(undefined);
  },
  async run(address: string): Promise<void> {
    return Promise.resolve(undefined);
  },
};
