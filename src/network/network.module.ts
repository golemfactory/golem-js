import { EventEmitter } from "eventemitter3";
import { NetworkOptions } from "./network";
import { GolemNetworkError, NetworkErrorCode } from "./error";
import { Logger, YagnaApi } from "../shared/utils";

export interface NetworkEvents {}

export interface NetworkNodeOptions {
  // todo
}

export interface NetworkModule {
  events: EventEmitter<NetworkEvents>;
  createNetwork(options: NetworkOptions): Promise<Network>;
  removeNetwork(networkId: string): Promise<void>;
  addNetworkNode(networkId: string, options: NetworkNodeOptions): Promise<NetworkNode>;
  removeNetworkNode(networkId: string, networkNodeId: string): Promise<void>;
}

export class NetworkModuleImpl implements NetworkModule {
  constructor(
    private readonly deps: {
      logger: Logger;
      yagna: YagnaApi;
      networkApi: INetworkApi;
    },
  ) {}

  async createNetwork(options: NetworkOptions): Promise<Network> {
    try {
      const { id, ip, mask } = await yagnaApi.net.createNetwork({
        id: config.ownerId,
        ip: config.ip,
        mask: config.mask,
        gateway: config.gateway,
      });
      const network = new Network(id!, yagnaApi, config);
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
    throw new Error("Method not implemented.");
  }
  removeNetworkNode(networkId: string, networkNodeId: string): Promise<void> {
    throw new Error("Method not implemented.");
  }
  events: EventEmitter<NetworkEvents> = new EventEmitter<NetworkEvents>();
}
