import { EventEmitter } from "eventemitter3";
import { Network } from "./network";
import { GolemNetworkError, NetworkErrorCode } from "./error";
import { Logger } from "../shared/utils";
import { INetworkApi } from "./api";
import { NetworkNode } from "./node";
import { IPv4, IPv4CidrRange, IPv4Mask } from "ip-num";

export interface NetworkEvents {}

export interface NetworkOptions {
  /**
   * The ID of the network.
   * This is an optional field that can be used to specify a unique identifier for the network.
   * If not provided, it will be generated automatically.
   */
  id?: string;

  /**
   * The IP address of the network. May contain netmask, e.g. "192.168.0.0/24".
   * This field can include the netmask directly in CIDR notation.
   */
  ip?: string;

  /**
   * The desired IP address of the requestor node within the newly-created network.
   * This field is optional and if not provided, the first available IP address will be assigned.
   */
  ownerIp?: string;

  /**
   * Optional network mask given in dotted decimal notation.
   * If the ip address was provided in Cidr notation this mask will override the mask from the Cidr notation
   */
  mask?: string;

  /**
   * Optional gateway address for the network.
   * This field can be used to specify a gateway IP address for the network.
   */
  gateway?: string;
}

export interface NetworkModule {
  events: EventEmitter<NetworkEvents>;

  /**
   * Creates a new network with the specified options.
   * @param options NetworkOptions
   */
  createNetwork(options?: NetworkOptions): Promise<Network>;

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
   * Retrieves the WebSocket URI for a specified network node and port.
   * @param networkNode - The network node for which the WebSocket URI is retrieved.
   * @param port - The port number for the WebSocket connection.
   */
  getWebsocketUri(networkNode: NetworkNode, port: number): string;
}

export class NetworkModuleImpl implements NetworkModule {
  events: EventEmitter<NetworkEvents> = new EventEmitter<NetworkEvents>();

  constructor(
    private readonly deps: {
      logger: Logger;
      networkApi: INetworkApi;
    },
  ) {}

  async createNetwork(options?: NetworkOptions): Promise<Network> {
    try {
      const ipDecimalDottedString = options?.ip?.split("/")?.[0] || "192.168.0.0";
      const maskBinaryNotation = parseInt(options?.ip?.split("/")?.[1] || "24");
      const maskPrefix = options?.mask ? IPv4Mask.fromDecimalDottedString(options.mask).prefix : maskBinaryNotation;
      const ipRange = IPv4CidrRange.fromCidr(`${IPv4.fromString(ipDecimalDottedString)}/${maskPrefix}`);
      const ip = ipRange.getFirst();
      const mask = ipRange.getPrefix().toMask();
      const gateway = options?.gateway ? new IPv4(options.gateway) : undefined;
      const network = await this.deps.networkApi.createNetwork({
        id: options?.id,
        ip: ip.toString(),
        mask: mask?.toString(),
        gateway: gateway?.toString(),
      });
      // add Requestor as network node
      const requestorId = await this.deps.networkApi.getIdentity();
      await this.createNetworkNode(network, requestorId, options?.ownerIp);
      this.deps.logger.info(`Network created`, network.getNetworkInfo());
      return network;
    } catch (error) {
      if (error instanceof GolemNetworkError) {
        throw error;
      }
      throw new GolemNetworkError(
        `Unable to create network. ${error?.response?.data?.message || error}`,
        NetworkErrorCode.NetworkCreationFailed,
        undefined,
        error,
      );
    }
  }
  async removeNetwork(network: Network): Promise<void> {
    try {
      await this.deps.networkApi.removeNetwork(network);
      this.deps.logger.info(`Network removed`, network.getNetworkInfo());
    } catch (error) {
      throw new GolemNetworkError(
        `Unable to remove network. ${error}`,
        NetworkErrorCode.NetworkRemovalFailed,
        undefined,
        error,
      );
    }
  }
  async createNetworkNode(network: Network, nodeId: string, nodeIp?: string): Promise<NetworkNode> {
    try {
      if (!network.isNodeIdUnique(nodeId)) {
        throw new GolemNetworkError(
          `Network ID '${nodeId}' has already been assigned in this network.`,
          NetworkErrorCode.AddressAlreadyAssigned,
          network.getNetworkInfo(),
        );
      }
      let ipv4: IPv4;
      if (nodeIp) {
        ipv4 = IPv4.fromString(nodeIp);
        if (!network.isIpInNetwork(ipv4)) {
          throw new GolemNetworkError(
            `The given IP ('${nodeIp}') address must belong to the network ('${network.getNetworkInfo().ip}').`,
            NetworkErrorCode.AddressOutOfRange,
            network.getNetworkInfo(),
          );
        }
        if (!network.isNodeIpUnique(ipv4)) {
          throw new GolemNetworkError(
            `IP '${nodeIp.toString()}' has already been assigned in this network.`,
            NetworkErrorCode.AddressAlreadyAssigned,
            network.getNetworkInfo(),
          );
        }
      } else {
        ipv4 = network.getFirstAvailableIpAddress();
      }
      const node = await this.deps.networkApi.createNetworkNode(network, nodeId, ipv4.toString());
      network.addNode(node);
      this.deps.logger.info(`Node has been added to the network.`, { id: nodeId, ip: ipv4.toString() });
      return node;
    } catch (error) {
      if (error instanceof GolemNetworkError) {
        throw error;
      }
      throw new GolemNetworkError(
        `Unable to add node to network. ${error?.data?.message || error.toString()}`,
        NetworkErrorCode.NodeAddingFailed,
        network.getNetworkInfo(),
        error,
      );
    }
  }
  async removeNetworkNode(network: Network, node: NetworkNode): Promise<void> {
    if (!network.hasNode(node)) {
      throw new GolemNetworkError(
        `The network node ${node.id} does not belong to the network`,
        NetworkErrorCode.NodeRemovalFailed,
        network.getNetworkInfo(),
      );
    }
    try {
      await this.deps.networkApi.removeNetworkNode(network, node);
      network.removeNode(node);
      this.deps.logger.info(`Node has been removed from the network.`, {
        network: network.getNetworkInfo().ip,
        nodeIp: node.ip,
      });
    } catch (error) {
      if (error instanceof GolemNetworkError) {
        throw error;
      }
      throw new GolemNetworkError(
        `Unable to remove network node. ${error}`,
        NetworkErrorCode.NodeRemovalFailed,
        network.getNetworkInfo(),
        error,
      );
    }
  }

  getWebsocketUri(networkNode: NetworkNode, port: number): string {
    return this.deps.networkApi.getWebsocketUri(networkNode, port);
  }
}
