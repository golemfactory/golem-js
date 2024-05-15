import { AbstractIPNum, IPv4, IPv4CidrRange, IPv4Mask, IPv4Prefix } from "ip-num";
import { NetworkNode } from "./node";
import { GolemNetworkError, NetworkErrorCode } from "./error";

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
  private gateway?: IPv4;
  private nodes = new Map<string, NetworkNode>();

  constructor(
    public readonly id: string,
    ip: string,
    mask?: string,
    gateway?: string,
  ) {
    this.ip = IPv4.fromString(ip);
    this.ipRange = IPv4CidrRange.fromCidr(mask ? `${ip}/${mask}` : ip);
    this.ipIterator = this.ipRange[Symbol.iterator]();
    this.mask = this.ipRange.getPrefix().toMask();
    this.gateway = gateway ? new IPv4(gateway) : undefined;
  }

  /**
   * Get Network Information
   * @return NetworkInfo
   */
  public getNetworkInfo(): NetworkInfo {
    return {
      id: this.id,
      ip: this.ip.toString(),
      mask: this.mask.toString(),
      nodes: Object.fromEntries(Array.from(this.nodes).map(([id, node]) => [node.ip.toString(), id])),
    };
  }

  public addNode(id: string, ip: string): NetworkNode {
    if (this.hasNode(id)) {
      throw new GolemNetworkError(
        `Node ${id} has already been adde to this network`,
        NetworkErrorCode.AddressAlreadyAssigned,
      );
    }
    const node = new NetworkNode(id, ip, this.getNetworkInfo.bind(this));
    this.nodes.set(node.id, node);
    return node;
  }

  /**
   * Checks whether the node belongs to the network
   * @param nodeId
   */
  public hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  public removeNode(nodeId: string) {
    this.nodes.delete(nodeId);
  }

  public getFirstAvailableIpAddress(): IPv4 {
    const ip = this.ipIterator.next().value;
    if (!ip)
      throw new GolemNetworkError(
        `No more addresses available in ${this.ipRange.toCidrString()}`,
        NetworkErrorCode.NoAddressesAvailable,
        this.getNetworkInfo(),
      );
    return ip;
  }

  public ensureIpInNetwork(ip: IPv4): boolean {
    if (!this.ipRange.contains(new IPv4CidrRange(ip, new IPv4Prefix(BigInt(this.mask.prefix)))))
      throw new GolemNetworkError(
        `The given IP ('${ip.toString()}') address must belong to the network ('${this.ipRange.toCidrString()}').`,
        NetworkErrorCode.AddressOutOfRange,
        this.getNetworkInfo(),
      );
    return true;
  }

  public ensureIpUnique(ip: IPv4) {
    if (!this.isIpUnique(ip))
      throw new GolemNetworkError(
        `IP '${ip.toString()}' has already been assigned in this network.`,
        NetworkErrorCode.AddressAlreadyAssigned,
        this.getNetworkInfo(),
      );
  }

  public ensureIdUnique(id: string) {
    if (this.nodes.has(id))
      throw new GolemNetworkError(
        `Network ID '${id}' has already been assigned in this network.`,
        NetworkErrorCode.AddressAlreadyAssigned,
        this.getNetworkInfo(),
      );
  }

  public isIpUnique(ip: IPv4): boolean {
    for (const node of this.nodes.values()) {
      if (new IPv4(node.ip).isEquals(ip)) return false;
    }
    return true;
  }
}
