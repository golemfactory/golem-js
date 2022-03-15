import { Net } from "../rest";
import { IPv4, IPv4Mask, IPv4Prefix, IPv4CidrRange } from "ip-num";
import { logger } from "../utils";

export class NetworkNode {
  constructor(
    public readonly node_id: string,
    public readonly ip: IPv4,
    private _get_network_info: () => NetworkInfo,
    private net_api_url: string
  ) {
  }

  get_deploy_args() {
    return {
      "net": [
        {
          ...this._get_network_info(),
          nodeIp: this.ip.toString()
        }
      ]
    }
  }

  get_websocket_uri(port: number) {
    const url = new URL(this.net_api_url)
    url.protocol = "ws";
    return `${url.href}/net/${this._get_network_info().id}/tcp/${this.ip}/${port}`;
  }
}

export enum NetworkStates {
  INITIALIZED = "initialize",
  CREATING = "create",
  READY = "ready",
  REMOVING = "removing",
  REMOVED = "removed",
}

interface NetworkInfo {
  id: string;
  ip: string;
  mask: string;
  nodes: { [ip: string]: string; }
}

export class NetworkError extends Error {}

export class Network {
  private _net_api: Net;
  private _state: NetworkStates;
  private _ip: IPv4;
  private _ip_range: IPv4CidrRange;
  private _mask: IPv4Mask;
  private _ip_iterator;
  private _owner_id: string;
  private _owner_ip: IPv4;
  private _gateway?: IPv4;
  private _nodes: Map<string, NetworkNode>;
  protected network_id?: string;

  constructor(net_api: Net,
              ip: string,
              owner_id: string,
              owner_ip?: string,
              mask?: string,
              gateway?: string) {
    this._net_api = net_api;
    this._state = NetworkStates.CREATING;
    this._ip_range = IPv4CidrRange.fromCidr(mask ? `${ip}/${mask}` : ip);
    this._ip_iterator = this._ip_range[Symbol.iterator]();
    this._ip = this._next_address();
    this._mask = this._ip_range.getPrefix().toMask();
    this._owner_id = owner_id;
    this._owner_ip = owner_ip ? new IPv4(owner_ip) : this._next_address();
    this._gateway = gateway ? new IPv4(gateway) : undefined;
    this._nodes = new Map<string, NetworkNode>();

  }
  get state() {
    return this._state;
  }

  toString() {
    return `{ id: ${this.network_id}, ip: ${this._ip}, mask: ${this._mask} }`;
  }

  async add_owner_address() {
    this._ensure_ip_in_network(this._owner_ip);
    this._ensure_ip_unique(this._owner_ip);
    this._nodes.set(this._owner_id, new NetworkNode(this._owner_id, this._owner_ip, this._get_network_info.bind(this), this._net_api.get_url()));
    await this._net_api.add_address(this.network_id!, this._owner_ip.toString());
  }

  async add_node(node_id: string, ip?: IPv4): Promise<NetworkNode> {
    // TODO: state ??
    if (ip) {
      this._ensure_ip_in_network(ip);
      this._ensure_ip_unique(ip);
    } else {
      while (true) {
        ip = this._next_address();
        if (this._is_ip_unique(ip)) break;
      }
    }
    const node = new NetworkNode(node_id, ip, this._get_network_info.bind(this), this._net_api.get_url());
    this._nodes.set(node_id, node);
    await this._net_api.add_node(this.network_id!, node_id, ip.toString());
    return node;
  }

  async refresh_nodes() {
    // TODO
  }

  async remove() {
    // TODO
  }

  _refresh_node(node: NetworkNode) {
    // TODO
  }

  _get_network_info(): NetworkInfo {
    return {
      id: this.network_id!,
      ip: this._ip.toString(),
      mask: this._mask.toString(),
      nodes: Object.fromEntries(Array.from(this._nodes).map(([id, node]) => [node.ip.toString(), id]))
    };
  }

  _next_address(): IPv4 {
    const ip = this._ip_iterator.next().value;
    if (!ip) throw new Error(`No more addresses available in ${this._ip_range.toCidrString()}`);
    return ip;
  }

  _ensure_ip_in_network(ip: IPv4) {
    if (!this._ip_range.contains(new IPv4CidrRange(ip, new IPv4Prefix(this._mask.prefix)))) {
      throw new NetworkError(`The given IP ('${ip.toString()}') address must belong to the network ('${this._ip_range.toCidrString()}').`);
    }
  }

  _ensure_ip_unique(ip: IPv4) {
    if (!this._is_ip_unique(ip)){
      throw new NetworkError(`'${ip.toString()}' has already been assigned in this network.`);
    }
  }

  _is_ip_unique(ip: IPv4): boolean {
    for (const node of this._nodes.values()) {
      if (node.ip.isEquals(ip)) return false
    }
    return true;
  }

  static async create(net_api: Net, ip: string, owner_id: string, owner_ip?: string, mask?: string, gateway?: string): Promise<Network> {
    const network = new Network(net_api, ip, owner_id, owner_ip, mask, gateway);
    network.network_id = await net_api.create_network(network._ip.toString(), network._mask.toString(), network._gateway?.toString());
    logger.info("Created network: " + network.toString());
    await network.add_owner_address();

    return network;
  }
}
