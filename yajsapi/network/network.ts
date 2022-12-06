import { IPv4, IPv4Mask, IPv4Prefix, IPv4CidrRange } from "ip-num";
import { Logger } from "../utils";
import { YagnaOptions } from "../executor";
import { NetworkConfig } from "./config";
import { NetworkNode } from "./node";

export interface NetworkOptions {
  ownerId: string;
  yagnaOptions?: YagnaOptions;
  ip?: string;
  ownerIp?: string;
  mask?: string;
  gateway?: string;
  logger?: Logger;
}

export interface NetworkInfo {
  id: string;
  ip: string;
  mask: string;
  nodes: { [ip: string]: string };
}

export class NetworkError extends Error {}

/**
 * Network
 *
 * @description Describes a VPN created between the requestor and the provider nodes within Golem Network.
 */
export class Network {
  private readonly ip: IPv4;
  private ipRange: IPv4CidrRange;
  private mask: IPv4Mask;
  private ownerId: string;
  private ownerIp: IPv4;
  private gateway?: IPv4;
  private nodes = new Map<string, NetworkNode>();
  private logger?: Logger;

  /**
   * Create a new VPN.
   *
   * @param options.ip        the IP address of the network. May contain netmask, e.g. "192.168.0.0/24"
   * @param options.ownerId   the node ID of the owner of this VPN (the requestor)
   * @parma options.logger    optional custom logger
   * @param options.ownerIp   the desired IP address of the requestor node within the newly-created network
   * @param options.mask      optional netmask (only if not provided within the `ip` argument)
   * @param options.gateway   optional gateway address for the network
   */
  static async create(options: NetworkOptions): Promise<Network> {
    const config = new NetworkConfig(options);
    try {
      const {
        data: { id, ip, mask },
      } = await config.api.createNetwork({
        id: config.ownerId,
        ip: config.ip,
        mask: config.mask,
        gateway: config.gateway,
      });
      const network = new Network(id!, config);
      await network.addNode(config.ownerId, config.ownerIp).catch(async (e) => {
        await config.api.removeNetwork(id as string);
        throw e;
      });
      config.logger?.info(`Created network: ID: ${id}, IP: ${ip}, Mask: ${mask}`);
      return network;
    } catch (error) {
      throw new Error(`Unable to create network. ${error?.response?.data?.message || error}`);
    }
  }

  private constructor(private id: string, public readonly config: NetworkConfig) {
    this.ipRange = IPv4CidrRange.fromCidr(`${config.ip}/${config.mask}`);
    this.ip = this.nextAddress();
    this.mask = this.ipRange.getPrefix().toMask();
    this.ownerId = config.ownerId;
    this.ownerIp = config.ownerIp ? new IPv4(config.ownerIp) : this.nextAddress();
    this.gateway = config.gateway ? new IPv4(config.gateway) : undefined;
    this.logger = config.logger;
  }

  private getNetworkInfo(): NetworkInfo {
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
    this.ensureIdUnique(nodeId);
    let ipv4: IPv4;
    if (ip) {
      ipv4 = IPv4.fromString(ip);
      this.ensureIpInNetwork(ipv4);
      this.ensureIpUnique(ipv4);
    } else {
      while (true) {
        ipv4 = this.nextAddress();
        if (this.ensureIpUnique(ipv4)) break;
      }
    }
    const node = new NetworkNode(nodeId, ipv4, this.getNetworkInfo.bind(this), this.getUrl());
    this.nodes.set(nodeId, node);
    await this.config.api.addNode(this.id, { id: nodeId, ip: ipv4.toString() });
    return node;
  }

  /**
   * Remove this network, terminating any connections it provides
   */
  async remove(): Promise<boolean> {
    try {
      await this.config.api.removeNetwork(this.id);
    } catch (error) {
      if (error.status === 404)
        this.logger?.warn(`Tried removing a network which doesn't exist. Network ID: ${this.id}`);
      return false;
    }
    this.logger?.info(`Removed network: ID: ${this.id}, IP: ${this.ip}`);
    return true;
  }

  private nextAddress(): IPv4 {
    const ip = this.ipRange[Symbol.iterator]().next().value;
    if (!ip) throw new Error(`No more addresses available in ${this.ipRange.toCidrString()}`);
    return ip;
  }

  private ensureIpInNetwork(ip: IPv4): boolean {
    if (!this.ipRange.contains(new IPv4CidrRange(ip, new IPv4Prefix(BigInt(this.mask.prefix)))))
      throw new NetworkError(
        `The given IP ('${ip.toString()}') address must belong to the network ('${this.ipRange.toCidrString()}').`
      );
    return true;
  }

  private ensureIpUnique(ip: IPv4): boolean {
    for (const node of this.nodes.values()) {
      if (node.ip.isEquals(ip))
        throw new NetworkError(`IP '${ip.toString()}' has already been assigned in this network.`);
    }
    return true;
  }

  private ensureIdUnique(id: string) {
    if (this.nodes.has(id)) throw new NetworkError(`ID '${id}' has already been assigned in this network.`);
  }

  private getUrl() {
    return this.config.apiUrl;
  }
}
