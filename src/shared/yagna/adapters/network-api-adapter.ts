import { YagnaApi } from "../yagnaApi";
import { GolemNetworkError, INetworkApi, Network, NetworkErrorCode, NetworkNode } from "../../../network";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";
import { cancelYagnaApiCall } from "../../utils/cancel";
import { createAbortSignalFromTimeout } from "../../utils";

export class NetworkApiAdapter implements INetworkApi {
  constructor(private readonly yagnaApi: YagnaApi) {}

  async createNetwork(
    options: { ip: string; mask?: string; gateway?: string },
    signalOrTimeout?: AbortSignal | number,
  ): Promise<Network> {
    try {
      const { id, ip, mask, gateway } = await cancelYagnaApiCall(
        this.yagnaApi.net.createNetwork(options),
        createAbortSignalFromTimeout(signalOrTimeout),
      );
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
  async removeNetwork(network: Network, signalOrTimeout?: AbortSignal | number): Promise<void> {
    try {
      await cancelYagnaApiCall(
        this.yagnaApi.net.removeNetwork(network.id),
        createAbortSignalFromTimeout(signalOrTimeout),
      );
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
  async createNetworkNode(
    network: Network,
    nodeId: string,
    nodeIp: string,
    signalOrTimeout?: AbortSignal | number,
  ): Promise<NetworkNode> {
    try {
      await cancelYagnaApiCall(
        this.yagnaApi.net.addNode(network.id, { id: nodeId, ip: nodeIp }),
        createAbortSignalFromTimeout(signalOrTimeout),
      );
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
  async removeNetworkNode(network: Network, node: NetworkNode, signalOrTimeout?: AbortSignal | number): Promise<void> {
    try {
      await cancelYagnaApiCall(
        this.yagnaApi.net.removeNode(network.id, node.id),
        createAbortSignalFromTimeout(signalOrTimeout),
      );
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

  async getIdentity(signalOrTimeout?: AbortSignal | number) {
    try {
      return await cancelYagnaApiCall(
        this.yagnaApi.identity.getIdentity(),
        createAbortSignalFromTimeout(signalOrTimeout),
      ).then((res) => res.identity);
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
