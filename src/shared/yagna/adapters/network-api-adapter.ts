import { YagnaApi } from "../yagnaApi";
import { Logger } from "../../utils";
import { INetworkApi } from "../../../network/api";
import { GolemNetworkError, Network, NetworkErrorCode, NetworkNode, NetworkOptions } from "../../../network";
import { IPv4 } from "ip-num";

export class NetworkApiAdapter implements INetworkApi {
  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly logger: Logger,
  ) {}

  async createNetwork(options: NetworkOptions): Promise<Network> {
    try {
      const { id, ip, mask, gateway } = await this.yagnaApi.net.createNetwork({
        id: options.ownerId,
        ip: options.ip ?? this.getDefaultNetworkIp(),
        mask: options.mask,
        gateway: options.gateway,
      });
      const network = new Network(id, ip, mask, gatewey);
      await network.addNode(network.ownerId, network.ownerIp.toString()).catch(async (e) => {
        await yagnaApi.net.removeNetwork(id as string);
        throw e;
      });
      config.logger.info(`Network created`, { id, ip, mask });
      return network;
    } catch (error) {
      if (error instanceof GolemNetworkError) {
        throw error;
      }
      throw new GolemNetworkError(
        `Unable to create network. ${error?.response?.data?.message || error}`,
        NetworkErrorCode.NetworkCreationFailed,
        undefined,
        error,
      );
    }
  }
  removeNetwork(networkId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  addNetworkNode(networkId: string, options: NetworkNodeOptions): Promise<NetworkNode> {
    try {
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
      this.logger.debug(`Node has added to the network.`, { id: nodeId, ip: ipv4.toString() });
      return node;
    } catch (error) {
      if (error instanceof GolemNetworkError) {
        throw error;
      }
      throw new GolemNetworkError(
        `Unable to add node to network. ${error?.data?.message || error.toString()}`,
        NetworkErrorCode.NodeAddingFailed,
        this.getNetworkInfo(),
        error,
      );
    }
  }
  removeNetworkNode(networkId: string, networkNodeId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }

  private getDefaultNetworkIp() {
    return "192.168.0.0";
  }
}
