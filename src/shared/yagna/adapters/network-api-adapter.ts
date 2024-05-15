import { YagnaApi } from "../yagnaApi";
import { Logger } from "../../utils";
import { INetworkApi } from "../../../network/api";
import { GolemNetworkError, Network, NetworkErrorCode, NetworkNode } from "../../../network";
import { IPv4 } from "ip-num";
import { NetworkOptions } from "../../../network/network.module";

export class NetworkApiAdapter implements INetworkApi {
  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly logger: Logger,
  ) {}

  async createNetwork(options: NetworkOptions): Promise<Network> {
    // TODO: Can we create a network without an id? or is it a bug in ya-client ?
    const { id, ip, mask, gateway } = await this.yagnaApi.net.createNetwork({
      id: options.id,
      ip: options.ip ?? "192.168.0.0",
      mask: options.mask,
      gateway: options.gateway,
    });
    const network = new Network(options.id, ip, mask, gateway);
    this.logger.info(`Network created`, { id, ip, mask });
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
