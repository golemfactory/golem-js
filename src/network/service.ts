import { defaultLogger, Logger, YagnaApi } from "../shared/utils";
import { Network, NetworkOptions } from "./network";
import { NetworkNode } from "./node";
import { GolemNetworkError, NetworkErrorCode } from "./error";

export type NetworkServiceOptions = Omit<NetworkOptions, "networkOwnerId">;

/**
 * Network Service
 * @description Service used in {@link TaskExecutor}
 * @internal
 */
export class NetworkService {
  private network?: Network;
  private logger: Logger;

  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly options?: NetworkServiceOptions,
  ) {
    this.logger = options?.logger || defaultLogger("network");
  }

  async run(networkOwnerId?: string) {
    if (!networkOwnerId) {
      const data = await this.yagnaApi.identity.getIdentity();
      networkOwnerId = data.identity;
    }

    this.network = await Network.create(this.yagnaApi, { ...this.options, networkOwnerId });
    this.logger.info("Network Service has started");
  }

  public async addNode(nodeId: string, ip?: string): Promise<NetworkNode> {
    if (!this.network)
      throw new GolemNetworkError(
        "The service is not started and the network does not exist",
        NetworkErrorCode.NetworkSetupMissing,
      );
    return this.network.addNode(nodeId, ip);
  }

  public async removeNode(nodeId: string): Promise<void> {
    if (!this.network)
      throw new GolemNetworkError(
        "The service is not started and the network does not exist",
        NetworkErrorCode.ServiceNotInitialized,
      );
    return this.network.removeNode(nodeId);
  }

  public hasNode(nodeId: string) {
    if (!this.network)
      throw new GolemNetworkError(
        "The service is not started and the network does not exist",
        NetworkErrorCode.ServiceNotInitialized,
      );
    return this.network.hasNode(nodeId);
  }

  async end() {
    await this.network?.remove();
    this.logger.info("Network Service has been stopped");
  }
}
