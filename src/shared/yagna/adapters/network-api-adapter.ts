import { YagnaApi } from "../yagnaApi";
import { Logger } from "../../utils";
import { GolemNetworkError, INetworkApi, Network, NetworkErrorCode, NetworkNode } from "../../../network";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";

export class NetworkApiAdapter implements INetworkApi {
  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly logger: Logger,
  ) {}

  async createNetwork(options: { id: string; ip: string; mask?: string; gateway?: string }): Promise<Network> {
    try {
      const { id, ip, mask, gateway } = await this.yagnaApi.net.createNetwork(options);
      return new Network(id, ip, mask, gateway);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemNetworkError(
        `Unable to create network. ${message}`,
        NetworkErrorCode.NetworkCreationFailed,
        undefined,
        error,
      );
    }
  }
  async removeNetwork(network: Network): Promise<void> {
    try {
      await this.yagnaApi.net.removeNetwork(network.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemNetworkError(
        `Unable to remove network. ${message}`,
        NetworkErrorCode.NetworkRemovalFailed,
        network.getNetworkInfo(),
        error,
      );
    }
  }
  async createNetworkNode(network: Network, nodeId: string, nodeIp: string): Promise<NetworkNode> {
    try {
      await this.yagnaApi.net.addNode(network.id, { id: nodeId, ip: nodeIp });
      const networkNode = new NetworkNode(
        nodeId,
        nodeIp,
        network.getNetworkInfo.bind(network),
        this.yagnaApi.net.httpRequest.config.BASE,
      );

      return networkNode;
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemNetworkError(
        `Unable to add node to network. ${message}`,
        NetworkErrorCode.NodeAddingFailed,
        network.getNetworkInfo(),
        error,
      );
    }
  }
  async removeNetworkNode(network: Network, node: NetworkNode): Promise<void> {
    try {
      await this.yagnaApi.net.removeNode(network.id, node.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemNetworkError(
        `Unable to remove network node. ${message}`,
        NetworkErrorCode.NodeRemovalFailed,
        network.getNetworkInfo(),
        error,
      );
    }
  }

  async getIdentity() {
    try {
      return await this.yagnaApi.identity.getIdentity().then((res) => res.identity);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemNetworkError(
        `Unable to get requestor identity. ${message}`,
        NetworkErrorCode.GettingIdentityFailed,
        undefined,
        error,
      );
    }
  }
}
