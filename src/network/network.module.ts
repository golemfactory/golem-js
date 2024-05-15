import { EventEmitter } from "eventemitter3";
import { Network } from "./network";
import { GolemNetworkError, NetworkErrorCode } from "./error";
import { Logger, YagnaApi } from "../shared/utils";
import { INetworkApi } from "./api";
import { NetworkNode } from "./node";

export interface NetworkEvents {}

export interface NetworkOptions {
  /** the node ID of the owner of this VPN (the requestor) */
  id: string;
  /** the IP address of the network. May contain netmask, e.g. "192.168.0.0/24" */
  ip?: string;
  /** the desired IP address of the requestor node within the newly-created network */
  ownerIp?: string;
  /** optional netmask (only if not provided within the `ip` argument) */
  mask?: string;
  /** optional gateway address for the network */
  gateway?: string;
}

export interface NetworkModule {
  events: EventEmitter<NetworkEvents>;
  createNetwork(options: NetworkOptions): Promise<Network>;
  removeNetwork(networkId: string): Promise<void>;
  addNetworkNode(network: Network, nodeId: string, nodeIp?: string): Promise<NetworkNode>;
  removeNetworkNode(network: Network, nodeId: string): Promise<void>;
  getWebsocketUri(networkNode: NetworkNode, port: number): string;
}

export class NetworkModuleImpl implements NetworkModule {
  events: EventEmitter<NetworkEvents> = new EventEmitter<NetworkEvents>();

  constructor(
    private readonly deps: {
      logger: Logger;
      yagna: YagnaApi;
      networkApi: INetworkApi;
    },
  ) {}

  async createNetwork(options: NetworkOptions): Promise<Network> {
    try {
      const network = await this.deps.networkApi.createNetwork(options);
      // add Requestor as network node
      const { identity } = await this.deps.yagna.identity.getIdentity();
      await this.deps.networkApi.addNetworkNode(network, identity, options.ownerIp);
      this.deps.logger.info(`Network created`, network.getNetworkInfo());
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
  async removeNetwork(networkId: string): Promise<void> {
    try {
      return this.deps.networkApi.removeNetwork(networkId);
    } catch (error) {
      throw new GolemNetworkError(
        `Unable to remove network. ${error}`,
        NetworkErrorCode.NetworkRemovalFailed,
        undefined,
        error,
      );
    }
  }
  async addNetworkNode(network: Network, nodeId: string, nodeIp?: string): Promise<NetworkNode> {
    try {
      return this.deps.networkApi.addNetworkNode(network, nodeId, nodeIp);
    } catch (error) {
      if (error instanceof GolemNetworkError) {
        throw error;
      }
      throw new GolemNetworkError(
        `Unable to add node to network. ${error}`,
        NetworkErrorCode.NodeAddingFailed,
        network.getNetworkInfo(),
        error,
      );
    }
  }
  removeNetworkNode(network: Network, nodeId: string): Promise<void> {
    try {
      return this.deps.networkApi.removeNetworkNode(network, nodeId);
    } catch (error) {
      if (error instanceof GolemNetworkError) {
        throw error;
      }
      throw new GolemNetworkError(
        `Unable to remove network node. ${error}`,
        NetworkErrorCode.NodeRemovalFailed,
        network.getNetworkInfo(),
        error,
      );
    }
  }

  getWebsocketUri(networkNode: NetworkNode, port: number): string {
    return this.deps.networkApi.getWebsocketUri(networkNode, port);
  }
}
