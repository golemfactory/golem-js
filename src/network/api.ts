import { Network } from "./network";
import { NetworkNode } from "./node";
import { NetworkOptions } from "./network.module";

export interface INetworkApi {
  createNetwork(options: NetworkOptions): Promise<Network>;
  removeNetwork(networkId: string): Promise<void>;
  addNetworkNode(network: Network, nodeId: string, nodeIp?: string): Promise<NetworkNode>;
  removeNetworkNode(network: Network, networkNodeId: string): Promise<void>;
  getWebsocketUri(networkNode: NetworkNode, port: number): string;
}
