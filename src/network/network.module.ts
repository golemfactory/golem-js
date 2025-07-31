import { EventEmitter } from "eventemitter3";
import { Network } from "./network";
import { GolemNetworkError, NetworkErrorCode } from "./error";
import { defaultLogger, Logger } from "../shared/utils";
import { INetworkApi, NetworkEvents } from "./api";
import { NetworkNode } from "./node";
import { IPv4, IPv4CidrRange, IPv4Mask } from "ip-num";
import AsyncLock from "async-lock";
import { getMessageFromApiError } from "../shared/utils/apiErrorMessage";

export interface NetworkOptions {
  /**
   * The IP address of the network. May contain netmask, e.g. "192.168.0.0/24".
   * This field can include the netmask directly in CIDR notation.
   * @default "192.168.0.0"
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
   * @param signalOrTimeout - The timeout in milliseconds or an AbortSignal that will be used to cancel the operation
   */
  createNetwork(options?: NetworkOptions, signalOrTimeout?: number | AbortSignal): Promise<Network>;

  /**
   * Removes an existing network.
   * @param network - The network to be removed.
   * @param signalOrTimeout - The timeout in milliseconds or an AbortSignal that will be used to cancel the operation
   */
  removeNetwork(network: Network, signalOrTimeout?: number | AbortSignal): Promise<void>;

  /**
   * Creates a new node within a specified network.
   * @param network - The network to which the node will be added.
   * @param nodeId - The ID of the node to be created.
   * @param nodeIp - Optional IP address for the node. If not provided, the first available IP address will be assigned.
   * @param signalOrTimeout - The timeout in milliseconds or an AbortSignal that will be used to cancel the operation
   */
  createNetworkNode(
    network: Network,
    nodeId: string,
    nodeIp?: string,
    signalOrTimeout?: number | AbortSignal,
  ): Promise<NetworkNode>;

  /**
   * Removes an existing node from a specified network.
   * @param network - The network from which the node will be removed.
   * @param node - The node to be removed.
   * @param signalOrTimeout - The timeout in milliseconds or an AbortSignal that will be used to cancel the operation
   */
  removeNetworkNode(network: Network, node: NetworkNode, signalOrTimeout?: number | AbortSignal): Promise<void>;
}

export class NetworkModuleImpl implements NetworkModule {
  events: EventEmitter<NetworkEvents> = new EventEmitter<NetworkEvents>();

  private readonly networkApi: INetworkApi;

  private readonly logger = defaultLogger("network");

  private lock: AsyncLock = new AsyncLock();

  constructor(deps: { logger?: Logger; networkApi: INetworkApi }) {
    this.networkApi = deps.networkApi;
    if (deps.logger) {
      this.logger = deps.logger;
    }
  }

  async createNetwork(options?: NetworkOptions, signalOrTimeout?: number | AbortSignal): Promise<Network> {
    this.logger.debug(`Creating network`, options);
    try {
      const ipDecimalDottedString = options?.ip?.split("/")?.[0] || "192.168.0.0";
      const maskBinaryNotation = parseInt(options?.ip?.split("/")?.[1] || "24");
      const maskPrefix = options?.mask ? IPv4Mask.fromDecimalDottedString(options.mask).prefix : maskBinaryNotation;
      const ipRange = IPv4CidrRange.fromCidr(`${IPv4.fromString(ipDecimalDottedString)}/${maskPrefix}`);
      const ip = ipRange.getFirst();
      const mask = ipRange.getPrefix().toMask();
      const gateway = options?.gateway ? new IPv4(options.gateway) : undefined;
      const network = await this.networkApi.createNetwork(
        {
          ip: ip.toString(),
          mask: mask?.toString(),
          gateway: gateway?.toString(),
        },
        signalOrTimeout,
      );
      // add Requestor as network node
      const requestorId = await this.networkApi.getIdentity(signalOrTimeout);
      await this.createNetworkNode(network, requestorId, options?.ownerIp);
      this.logger.info(`Created network`, network.getNetworkInfo());
      this.events.emit("networkCreated", { network });
      return network;
    } catch (err) {
      const message = getMessageFromApiError(err);
      const error =
        err instanceof GolemNetworkError
          ? err
          : new GolemNetworkError(
              `Unable to create network. ${message}`,
              NetworkErrorCode.NetworkCreationFailed,
              undefined,
              err,
            );
      this.events.emit("errorCreatingNetwork", { error });
      throw error;
    }
  }
  async removeNetwork(network: Network, signalOrTimeout?: number | AbortSignal): Promise<void> {
    this.logger.debug(`Removing network`, network.getNetworkInfo());
    await this.lock.acquire(`net-${network.id}`, async () => {
      try {
        await this.networkApi.removeNetwork(network, signalOrTimeout);
        network.markAsRemoved();
        this.logger.info(`Removed network`, network.getNetworkInfo());
        this.events.emit("networkRemoved", { network });
      } catch (error) {
        this.events.emit("errorRemovingNetwork", { network, error });
        throw error;
      }
    });
  }

  async createNetworkNode(
    network: Network,
    nodeId: string,
    nodeIp?: string,
    signalOrTimeout?: number | AbortSignal,
  ): Promise<NetworkNode> {
    this.logger.debug(`Creating network node`, { nodeId, nodeIp });
    return await this.lock.acquire(`net-${network.id}`, async () => {
      try {
        if (!network.isNodeIdUnique(nodeId)) {
          throw new GolemNetworkError(
            `Network ID '${nodeId}' has already been assigned in this network.`,
            NetworkErrorCode.AddressAlreadyAssigned,
            network.getNetworkInfo(),
          );
        }
        if (network.isRemoved()) {
          throw new GolemNetworkError(
            `Unable to create network node ${nodeId}. Network has already been removed`,
            NetworkErrorCode.NetworkRemoved,
            network.getNetworkInfo(),
          );
        }
        const ipv4 = this.getFreeIpInNetwork(network, nodeIp);
        const node = await this.networkApi.createNetworkNode(network, nodeId, ipv4.toString(), signalOrTimeout);
        network.addNode(node);
        this.logger.info(`Added network node`, { id: nodeId, ip: ipv4.toString() });
        this.events.emit("nodeCreated", { network, node });
        return node;
      } catch (error) {
        this.events.emit("errorCreatingNode", { network, error });
        throw error;
      }
    });
  }

  async removeNetworkNode(network: Network, node: NetworkNode, signalOrTimeout?: number | AbortSignal): Promise<void> {
    this.logger.debug(`Removing network node`, { nodeId: node.id, nodeIp: node.ip });
    return await this.lock.acquire(`net-${network.id}`, async () => {
      try {
        if (!network.hasNode(node)) {
          throw new GolemNetworkError(
            `The network node ${node.id} does not belong to the network`,
            NetworkErrorCode.NodeRemovalFailed,
            network.getNetworkInfo(),
          );
        }
        if (network.isRemoved()) {
          this.logger.debug(`Unable to remove network node ${node.id}. Network has already been removed`, {
            network,
            node,
          });
          return;
        }
        await this.networkApi.removeNetworkNode(network, node, signalOrTimeout);
        network.removeNode(node);
        this.logger.info(`Removed network node`, {
          network: network.getNetworkInfo().ip,
          nodeIp: node.ip,
        });
        this.events.emit("nodeRemoved", { network, node });
      } catch (error) {
        this.events.emit("errorRemovingNode", { network, node, error });
        throw error;
      }
    });
  }

  private getFreeIpInNetwork(network: Network, targetIp?: string): IPv4 {
    if (!targetIp) {
      return network.getFirstAvailableIpAddress();
    }
    const ipv4 = IPv4.fromString(targetIp);
    if (!network.isIpInNetwork(ipv4)) {
      throw new GolemNetworkError(
        `The given IP ('${targetIp}') address must belong to the network ('${network.getNetworkInfo().ip}').`,
        NetworkErrorCode.AddressOutOfRange,
        network.getNetworkInfo(),
      );
    }
    if (!network.isNodeIpUnique(ipv4)) {
      throw new GolemNetworkError(
        `IP '${targetIp.toString()}' has already been assigned in this network.`,
        NetworkErrorCode.AddressAlreadyAssigned,
        network.getNetworkInfo(),
      );
    }
    return ipv4;
  }
}
