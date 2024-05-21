import { YagnaApi } from "../yagnaApi";
import { Logger } from "../../utils";
import { INetworkApi } from "../../../network/api";
import { Network, NetworkNode } from "../../../network";

export class NetworkApiAdapter implements INetworkApi {
  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly logger: Logger,
  ) {}

  async createNetwork(options: { id: string; ip: string; mask?: string; gateway?: string }): Promise<Network> {
    const { id, ip, mask, gateway } = await this.yagnaApi.net.createNetwork(options);
    // @ts-expect-error TODO: Can we create a network without an id or is this just a bug in ya-clinet spec?
    return new Network(id, ip, mask, gateway);
  }
  async removeNetwork(network: Network): Promise<void> {
    return this.yagnaApi.net.removeNetwork(network.id);
  }
  async createNetworkNode(network: Network, nodeId: string, nodeIp: string): Promise<NetworkNode> {
    const { id, ip } = await this.yagnaApi.net.addNode(network.id, { id: nodeId, ip: nodeIp });
    return new NetworkNode(id, ip, network.getNetworkInfo);
  }
  async removeNetworkNode(network: Network, node: NetworkNode): Promise<void> {
    await this.yagnaApi.net.removeNode(network.id, node.id);
  }

  async getIdentity() {
    return this.yagnaApi.identity.getIdentity().then((res) => res.identity);
  }

  getWebsocketUri(networkNode: NetworkNode, port: number) {
    const url = new URL(this.yagnaApi.basePath);
    url.protocol = "ws";
    return `${url.href}/net/${networkNode.getNetworkInfo().id}/tcp/${networkNode.ip}/${port}`;
  }
}
