import { Network } from "./network";
import { NetworkNode } from "./node";
import { NetworkOptions } from "./network.module";

export interface NetworkEvents {
  networkCreated: (event: { network: Network }) => void;
  errorCreatingNetwork: (event: { error: Error }) => void;

  networkRemoved: (event: { network: Network }) => void;
  errorRemovingNetwork: (event: { network: Network; error: Error }) => void;

  nodeCreated: (event: { network: Network; node: NetworkNode }) => void;
  errorCreatingNode: (event: { network: Network; error: Error }) => void;

  nodeRemoved: (event: { network: Network; node: NetworkNode }) => void;
  errorRemovingNode: (event: { network: Network; node: NetworkNode; error: Error }) => void;
}

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
}
