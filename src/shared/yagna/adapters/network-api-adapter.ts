import { YagnaApi } from "../yagnaApi";
import { Logger } from "../../utils";
import { INetworkApi } from "../../../network/api";
import { GolemNetworkError, Network, NetworkErrorCode, NetworkNode } from "../../../network";
import { IPv4, IPv4CidrRange, IPv4Mask } from "ip-num";
import { NetworkOptions } from "../../../network/network.module";

export class NetworkApiAdapter implements INetworkApi {
  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly logger: Logger,
  ) {}

  async createNetwork(options: NetworkOptions): Promise<Network> {
    const ipSplited = options.ip?.split("/");
    const ipString = ipSplited?.[0] || "192.168.0.0";
    const maskPrefix = options.mask ? IPv4Mask.fromDecimalDottedString(options.mask).prefix : ipSplited?.[1] ?? 24;

    const ip = IPv4.fromString(ipSplited?.[0] || "192.168.0.0");
    const ipRange = IPv4CidrRange.fromCidr(`${ip}/${maskPrefix}`);
    const mask = ipRange.getPrefix().toMask();
    const gateway = options.gateway ? new IPv4(options.gateway) : undefined;
    console.log({
      id: options.id,
      ip: ip.toString(),
      mask: mask?.toString(),
      gateway: gateway?.toString(),
    });
    // TODO: Can we create a network without an id? or is it a bug in ya-client ?
    const createdNetwork = await this.yagnaApi.net.createNetwork({
      id: options.id,
      ip: ip.toString(),
      mask: mask?.toString(),
      gateway: gateway?.toString(),
    });
    const network = new Network(options.id, createdNetwork.ip, createdNetwork.mask, createdNetwork.gateway);
    this.logger.info(`Network created`, createdNetwork);
    return network;
  }
  async removeNetwork(networkId: string): Promise<void> {
    return this.yagnaApi.net.removeNetwork(networkId);
  }
  async addNetworkNode(network: Network, nodeId: string, nodeIp?: string): Promise<NetworkNode> {
    try {
      network.ensureIdUnique(nodeId);
      let ipv4: IPv4;
      if (nodeIp) {
        ipv4 = IPv4.fromString(nodeIp);
        network.ensureIpInNetwork(ipv4);
        network.ensureIpUnique(ipv4);
      } else {
        ipv4 = network.getFirstAvailableIpAddress();
      }
      const { id, ip } = await this.yagnaApi.net.addNode(network.id, { id: nodeId, ip: ipv4.toString() });
      const node = network.addNode(id, ip);
      this.logger.debug(`Node has added to the network.`, { id: nodeId, ip: ipv4.toString() });
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
  async removeNetworkNode(network: Network, nodeId: string): Promise<void> {
    await this.yagnaApi.net.removeNode(network.id, nodeId);
    network.removeNode(nodeId);
  }

  getWebsocketUri(networkNode: NetworkNode, port: number) {
    const url = new URL(this.yagnaApi.basePath);
    url.protocol = "ws";
    return `${url.href}/net/${networkNode.getNetworkInfo().id}/tcp/${networkNode.ip}/${port}`;
  }
}
