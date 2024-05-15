import { AbstractIPNum, IPv4, IPv4CidrRange, IPv4Mask, IPv4Prefix } from "ip-num";
import { NetworkNode } from "./node";
import { GolemNetworkError, NetworkErrorCode } from "./error";

export interface NetworkOptions {
  /** the node ID of the owner of this VPN (the requestor) */
  ownerId: string;
  /** the IP address of the network. May contain netmask, e.g. "192.168.0.0/24" */
  ip?: string;
  /** the desired IP address of the requestor node within the newly-created network */
  ownerIp?: string;
  /** optional netmask (only if not provided within the `ip` argument) */
  mask?: string;
  /** optional gateway address for the network */
  gateway?: string;
}

export interface NetworkInfo {
  id: string;
  ip: string;
  mask: string;
  nodes: { [ip: string]: string };
}

export class Network {
  private readonly ip: IPv4;
  private readonly ipRange: IPv4CidrRange;
  private ipIterator: Iterator<AbstractIPNum>;
  private mask: IPv4Mask;
  private ownerId: string;
  private ownerIp: IPv4;
  private gateway?: IPv4;
  private nodes = new Map<string, NetworkNode>();

  /**
   * @param id
   * @param config
   * @private
   * @hidden
   */
  private constructor(
    public readonly id: string,
    public readonly ip: string,
    public readonly mask: string,
    public readonly gatewey: string,
  ) {
    this.ipRange = IPv4CidrRange.fromCidr(mask ? `${ip}/${mask}` : ip);
    this.ipIterator = this.ipRange[Symbol.iterator]();
    this.ip = this.nextAddress();
    this.mask = this.ipRange.getPrefix().toMask();
    this.ownerId = options.ownerId;
    this.ownerIp = options.ownerIp ? new IPv4(options.ownerIp) : this.nextAddress();
    this.gateway = options.gateway ? new IPv4(options.gateway) : undefined;
  }

  /**
   * Get Network Information
   * @return NetworkInfo
   */
  getNetworkInfo(): NetworkInfo {
    return {
      id: this.id,
      ip: this.ip.toString(),
      mask: this.mask.toString(),
      nodes: Object.fromEntries(Array.from(this.nodes).map(([id, node]) => [node.ip.toString(), id])),
    };
  }

  /**
   * Add a new node to the network.
   *
   * @param nodeId Node ID within the Golem network of this VPN node
   * @param ip  IP address to assign to this node
   */
  async addNode(nodeId: string, ip?: string): Promise<NetworkNode> {
    try {
      this.ensureIdUnique(nodeId);
      let ipv4: IPv4;
      if (ip) {
        ipv4 = IPv4.fromString(ip);
        this.ensureIpInNetwork(ipv4);
        this.ensureIpUnique(ipv4);
      } else {
        while (true) {
          ipv4 = this.nextAddress();
          if (this.isIpUnique(ipv4)) break;
        }
      }
      const node = new NetworkNode(nodeId, ipv4, this.getNetworkInfo.bind(this), this.getUrl());
      this.nodes.set(nodeId, node);
      await this.yagnaApi.net.addNode(this.id, { id: nodeId, ip: ipv4.toString() });
      this.logger.debug(`Node has added to the network.`, { id: nodeId, ip: ipv4.toString() });
      return node;
    } catch (error) {
      if (error instanceof GolemNetworkError) {
        throw error;
      }
      throw new GolemNetworkError(
        `Unable to add node to network. ${error?.data?.message || error.toString()}`,
        NetworkErrorCode.NodeAddingFailed,
        this.getNetworkInfo(),
        error,
      );
    }
  }

  /**
   * Remove the node from the network
   * @param nodeId
   */
  async removeNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new GolemNetworkError(
        `Unable to remove node ${nodeId}. There is no such node in the network`,
        NetworkErrorCode.NodeRemovalFailed,
        this.getNetworkInfo(),
      );
    }
    try {
      await this.yagnaApi.net.removeNode(this.id, nodeId);
      this.nodes.delete(nodeId);
      this.logger.debug(`Node has removed from the network.`, { id: nodeId, ip: node.ip.toString() });
    } catch (error) {
      throw new GolemNetworkError(
        `Unable to remove node ${nodeId}. ${error}`,
        NetworkErrorCode.NetworkRemovalFailed,
        this.getNetworkInfo(),
        error,
      );
    }
  }

  /**
   * Checks whether the node belongs to the network
   * @param nodeId
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Remove this network, terminating any connections it provides
   */
  async remove(): Promise<void> {
    try {
      await this.yagnaApi.net.removeNetwork(this.id);
      this.logger.info(`Network has removed:`, { id: this.id, ip: this.ip.toString() });
    } catch (error) {
      throw new GolemNetworkError(
        `Unable to remove network. ${error?.data?.message || error.toString()}`,
        NetworkErrorCode.NetworkRemovalFailed,
        this.getNetworkInfo(),
        error,
      );
    }
  }

  private nextAddress(): IPv4 {
    const ip = this.ipIterator.next().value;
    if (!ip)
      throw new GolemNetworkError(
        `No more addresses available in ${this.ipRange.toCidrString()}`,
        NetworkErrorCode.NoAddressesAvailable,
        this.getNetworkInfo(),
      );
    return ip;
  }

  private ensureIpInNetwork(ip: IPv4): boolean {
    if (!this.ipRange.contains(new IPv4CidrRange(ip, new IPv4Prefix(BigInt(this.mask.prefix)))))
      throw new GolemNetworkError(
        `The given IP ('${ip.toString()}') address must belong to the network ('${this.ipRange.toCidrString()}').`,
        NetworkErrorCode.AddressOutOfRange,
        this.getNetworkInfo(),
      );
    return true;
  }

  private ensureIpUnique(ip: IPv4) {
    if (!this.isIpUnique(ip))
      throw new GolemNetworkError(
        `IP '${ip.toString()}' has already been assigned in this network.`,
        NetworkErrorCode.AddressAlreadyAssigned,
        this.getNetworkInfo(),
      );
  }

  private ensureIdUnique(id: string) {
    if (this.nodes.has(id))
      throw new GolemNetworkError(
        `Network ID '${id}' has already been assigned in this network.`,
        NetworkErrorCode.AddressAlreadyAssigned,
        this.getNetworkInfo(),
      );
  }

  private isIpUnique(ip: IPv4): boolean {
    for (const node of this.nodes.values()) {
      if (node.ip.isEquals(ip)) return false;
    }
    return true;
  }

  private getUrl() {
    return this.yagnaApi.net.httpRequest.config.BASE;
  }
}
