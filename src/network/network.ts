import { AbstractIPNum, IPv4, IPv4CidrRange, IPv4Mask, IPv4Prefix } from "ip-num";
import { NetworkNode } from "./node";
import { GolemNetworkError, NetworkErrorCode } from "./error";

export interface NetworkInfo {
  id: string;
  ip: string;
  mask: string;
  gateway?: string;
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
    this.ipRange = IPv4CidrRange.fromCidr(mask ? `${ip}/${IPv4Mask.fromDecimalDottedString(mask).prefix}` : ip);
    this.ipIterator = this.ipRange[Symbol.iterator]();
    this.ip = this.getFirstAvailableIpAddress();
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
      gateway: this.gateway?.toString(),
      nodes: Object.fromEntries(Array.from(this.nodes).map(([id, node]) => [node.ip.toString(), id])),
    };
  }

  public addNode(node: NetworkNode): void {
    if (this.hasNode(node)) {
      throw new GolemNetworkError(
        `Node ${node.id} has already been added to this network`,
        NetworkErrorCode.AddressAlreadyAssigned,
      );
    }
    this.nodes.set(node.id, node);
  }

  /**
   * Checks whether the node belongs to the network
   * @param nodeId
   */
  public hasNode(node: NetworkNode): boolean {
    return this.nodes.has(node.id);
  }

  public removeNode(node: NetworkNode) {
    if (!this.hasNode(node)) {
      throw new GolemNetworkError(`There is no node ${node.id} in the network`, NetworkErrorCode.NodeRemovalFailed);
    }
    this.nodes.delete(node.id);
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

  public isIpInNetwork(ip: IPv4): boolean {
    return this.ipRange.contains(new IPv4CidrRange(ip, new IPv4Prefix(BigInt(this.mask.prefix))));
  }

  public isNodeIdUnique(id: string): boolean {
    return !this.nodes.has(id);
  }

  public isNodeIpUnique(ip: IPv4): boolean {
    for (const node of this.nodes.values()) {
      if (new IPv4(node.ip).isEquals(ip)) return false;
    }
    return true;
  }
}
