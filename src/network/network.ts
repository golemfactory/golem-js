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

export enum NetworkState {
  Active = "Active",
  Removed = "Removed",
}

export class Network {
  private readonly ip: IPv4;
  private readonly ipRange: IPv4CidrRange;
  private ipIterator: Iterator<AbstractIPNum>;
  private mask: IPv4Mask;
  private gateway?: IPv4;
  private nodes = new Map<string, NetworkNode>();
  private state: NetworkState = NetworkState.Active;

  constructor(
    public readonly id: string,
    ip: string,
    mask?: string,
    gateway?: string,
  ) {
    this.ipRange = IPv4CidrRange.fromCidr(
      mask ? `${ip.split("/")[0]}/${IPv4Mask.fromDecimalDottedString(mask).prefix}` : ip,
    );
    this.ipIterator = this.ipRange[Symbol.iterator]();
    this.ip = this.getFirstAvailableIpAddress();
    this.mask = this.ipRange.getPrefix().toMask();
    this.gateway = gateway ? new IPv4(gateway) : undefined;
  }

  /**
   * Returns information about the network.
   */
  public getNetworkInfo(): NetworkInfo {
    return {
      id: this.id,
      ip: this.ip.toString(),
      mask: this.mask.toString(),
      gateway: this.gateway?.toString?.(),
      nodes: Object.fromEntries(Array.from(this.nodes).map(([id, node]) => [node.ip, id])),
    };
  }

  /**
   * Adds a node to the network.
   * @param node - The network node to be added.
   */
  public addNode(node: NetworkNode) {
    if (this.isRemoved()) {
      throw new GolemNetworkError(
        `Unable to add node ${node.id} to removed network`,
        NetworkErrorCode.NetworkRemoved,
        this.getNetworkInfo(),
      );
    }
    if (this.hasNode(node)) {
      throw new GolemNetworkError(
        `Node ${node.id} has already been added to this network`,
        NetworkErrorCode.AddressAlreadyAssigned,
      );
    }
    this.nodes.set(node.id, node);
  }

  /**
   * Checks whether the node belongs to the network.
   * @param node - The network node to check.
   */
  public hasNode(node: NetworkNode): boolean {
    return this.nodes.has(node.id);
  }

  /**
   * Removes a node from the network.
   * @param node - The network node to be removed.
   */
  public removeNode(node: NetworkNode) {
    if (this.isRemoved()) {
      throw new GolemNetworkError(
        `Unable to remove node ${node.id} from removed network`,
        NetworkErrorCode.NetworkRemoved,
        this.getNetworkInfo(),
      );
    }
    if (!this.hasNode(node)) {
      throw new GolemNetworkError(`There is no node ${node.id} in the network`, NetworkErrorCode.NodeRemovalFailed);
    }
    this.nodes.delete(node.id);
  }

  public remove() {
    if (this.state === NetworkState.Removed) {
      throw new GolemNetworkError("Network already removed", NetworkErrorCode.NetworkRemoved, this.getNetworkInfo());
    }
    this.state = NetworkState.Removed;
  }

  /**
   * Returns the first available IP address in the network.
   */
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

  /**
   * Checks if a given IP address is within the network range.
   * @param ip - The IPv4 address to check.
   */
  public isIpInNetwork(ip: IPv4): boolean {
    return this.ipRange.contains(new IPv4CidrRange(ip, new IPv4Prefix(BigInt(this.mask.prefix))));
  }

  /**
   * Checks if a given node ID is unique within the network.
   * @param id - The node ID to check.
   */
  public isNodeIdUnique(id: string): boolean {
    return !this.nodes.has(id);
  }

  /**
   * Checks if a given IP address is unique within the network.
   */
  public isNodeIpUnique(ip: IPv4): boolean {
    for (const node of this.nodes.values()) {
      if (new IPv4(node.ip).isEquals(ip)) return false;
    }
    return true;
  }

  public isRemoved() {
    return this.state === NetworkState.Removed;
  }
}
