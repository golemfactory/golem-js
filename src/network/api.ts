import { Network } from "./network";
import { NetworkNodeOptions, NetworkOptions } from "./network.module";
import { NetworkNode } from "./node";

export interface INetworkApi {
  createNetwork(options: NetworkOptions): Promise<Network>;
  removeNetwork(networkId: string): Promise<void>;
  addNetworkNode(networkId: string, options: NetworkNodeOptions): Promise<NetworkNode>;
  removeNetworkNode(networkId: string, networkNodeId: string): Promise<void>;
}
