import { Network } from "./network";
import { NetworkNode } from "./node";
import { NetworkOptions } from "./network.module";

export interface INetworkApi {
  /**
   * Creates a new network with the specified options.
   * @param options NetworkOptions
   */
  createNetwork(options: NetworkOptions): Promise<Network>;

  /**
   * Removes an existing network.
   * @param network - The network to be removed.
   */
  removeNetwork(network: Network): Promise<void>;

  /**
   * Creates a new node within a specified network.
   * @param network - The network to which the node will be added.
   * @param nodeId - The ID of the node to be created.
   * @param nodeIp - Optional IP address for the node. If not provided, the first available IP address will be assigned.
   */

  createNetworkNode(network: Network, nodeId: string, nodeIp?: string): Promise<NetworkNode>;

  /**
   * Removes an existing node from a specified network.
   * @param network - The network from which the node will be removed.
   * @param node - The node to be removed.
   */
  removeNetworkNode(network: Network, node: NetworkNode): Promise<void>;

  /**
   * Returns the identifier of the requesor
   */
  getIdentity(): Promise<string>;

  /**
   * Retrieves the WebSocket URI for a specified network node and port.
   * @param networkNode - The network node for which the WebSocket URI is retrieved.
   * @param port - The port number for the WebSocket connection.
   */
  getWebsocketUri(networkNode: NetworkNode, port: number): string;
}