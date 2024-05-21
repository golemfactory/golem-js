import { Network } from "./network";
import { NetworkNode } from "./node";
import { NetworkOptions } from "./network.module";

export interface INetworkApi {
  createNetwork(options: NetworkOptions): Promise<Network>;
  removeNetwork(network: Network): Promise<void>;
  createNetworkNode(network: Network, nodeId: string, nodeIp?: string): Promise<NetworkNode>;
  removeNetworkNode(network: Network, node: NetworkNode): Promise<void>;
  getIdentity(): Promise<string>;
  getWebsocketUri(networkNode: NetworkNode, port: number): string;
}
