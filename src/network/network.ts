import { IPv4, IPv4Mask, IPv4Prefix, IPv4CidrRange, AbstractIPNum } from "ip-num";
import { Logger } from "../utils";
import { YagnaOptions } from "../executor";
import { NetworkConfig } from "./config";
import { NetworkNode } from "./node";
import { YagnaApi } from "../utils/yagna/yagna";
import { GolemError } from "../error/golem-error";

/**
 * @hidden
 */
export interface NetworkOptions {
  /** the node ID of the owner of this VPN (the requestor) */
  networkOwnerId: string;
  /** {@link YagnaOptions} */
  yagnaOptions?: YagnaOptions;
  /** the IP address of the network. May contain netmask, e.g. "192.168.0.0/24" */
  networkIp?: string;
  /** the desired IP address of the requestor node within the newly-created network */
  networkOwnerIp?: string;
  /** optional netmask (only if not provided within the `ip` argument) */
  networkMask?: string;
  /** optional gateway address for the network */
  networkGateway?: string;
  /** optional custom logger module */
  logger?: Logger;
}

export interface NetworkInfo {
  id: string;
  ip: string;
  mask: string;
  nodes: { [ip: string]: string };
}

export class NetworkError extends GolemError {}

/**
 * Network module - an object represents VPN created between the requestor and the provider nodes within Golem Network.
 * @hidden
 */
export class Network {
  private readonly ip: IPv4;
  private readonly ipRange: IPv4CidrRange;
  private ipIterator: Iterator<AbstractIPNum>;
  private mask: IPv4Mask;
  private ownerId: string;
  private ownerIp: IPv4;
  private gateway?: IPv4;
  private nodes = new Map<string, NetworkNode>();
  private logger: Logger;

  /**
   * Create a new VPN.
   *
   * @param yagnaApi - {@link YagnaApi}
   * @param options - {@link NetworkOptions}
   */
  static async create(yagnaApi: YagnaApi, options: NetworkOptions): Promise<Network> {
    const config = new NetworkConfig(options);
    try {
      const {
        data: { id, ip, mask },
      } = await yagnaApi.net.createNetwork({
        id: config.ownerId,
        ip: config.ip,
        mask: config.mask,
        gateway: config.gateway,
      });
      const network = new Network(id!, yagnaApi, config);
      await network.addNode(network.ownerId, network.ownerIp.toString()).catch(async (e) => {
        await yagnaApi.net.removeNetwork(id as string);
        throw e;
      });
      config.logger.info(`Network created`, { id, ip, mask });
      return network;
    } catch (error) {
      throw new GolemError(`Unable to create network. ${error?.response?.data?.message || error}`);
    }
  }

  /**
   * @param id
   * @param yagnaApi
   * @param config
   * @private
   * @hidden
   */
  private constructor(
    public readonly id: string,
    private readonly yagnaApi: YagnaApi,
    public readonly config: NetworkConfig,
  ) {
    this.ipRange = IPv4CidrRange.fromCidr(config.mask ? `${config.ip}/${config.mask}` : config.ip);
    this.ipIterator = this.ipRange[Symbol.iterator]();
    this.ip = this.nextAddress();
    this.mask = this.ipRange.getPrefix().toMask();
    this.ownerId = config.ownerId;
    this.ownerIp = config.ownerIp ? new IPv4(config.ownerIp) : this.nextAddress();
    this.gateway = config.gateway ? new IPv4(config.gateway) : undefined;
    this.logger = config.logger;
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
    this.logger.info(`Node has added to the network.`, { id: nodeId, ip: ipv4.toString() });
    return node;
  }

  /**
   * Remove this network, terminating any connections it provides
   */
  async remove(): Promise<boolean> {
    try {
      await this.yagnaApi.net.removeNetwork(this.id);
    } catch (error) {
      if (error.status === 404) this.logger.error(`Tried removing a network which doesn't exist.`, { id: this.id });
      return false;
    }
    this.logger.info(`Network has removed:`, { id: this.id, ip: this.ip.toString() });
    return true;
  }

  private nextAddress(): IPv4 {
    const ip = this.ipIterator.next().value;
    if (!ip) throw new GolemError(`No more addresses available in ${this.ipRange.toCidrString()}`);
    return ip;
  }

  private ensureIpInNetwork(ip: IPv4): boolean {
    if (!this.ipRange.contains(new IPv4CidrRange(ip, new IPv4Prefix(BigInt(this.mask.prefix)))))
      throw new NetworkError(
        `The given IP ('${ip.toString()}') address must belong to the network ('${this.ipRange.toCidrString()}').`,
      );
    return true;
  }

  private ensureIpUnique(ip: IPv4) {
    if (!this.isIpUnique(ip))
      throw new NetworkError(`IP '${ip.toString()}' has already been assigned in this network.`);
  }

  private ensureIdUnique(id: string) {
    if (this.nodes.has(id)) throw new NetworkError(`ID '${id}' has already been assigned in this network.`);
  }

  private isIpUnique(ip: IPv4): boolean {
    for (const node of this.nodes.values()) {
      if (node.ip.isEquals(ip)) return false;
    }
    return true;
  }

  private getUrl() {
    return this.yagnaApi.net["basePath"];
  }
}
