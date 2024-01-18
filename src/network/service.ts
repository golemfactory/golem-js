import { Logger, YagnaApi } from "../utils";
import { Network } from "./index";
import { NetworkOptions } from "./network";
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
  private logger?: Logger;

  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly options?: NetworkServiceOptions,
  ) {
    this.logger = options?.logger;
  }

  async run(networkOwnerId?: string) {
    if (!networkOwnerId) {
      const data = await this.yagnaApi.identity.getIdentity();
      networkOwnerId = data.identity;
    }
    this.network = await Network.create(this.yagnaApi, { ...this.options, networkOwnerId });
    this.logger?.debug("Network Service has started");
  }

  public async addNode(nodeId: string, ip?: string): Promise<NetworkNode> {
    if (!this.network)
      throw new GolemNetworkError(
        "The service is not started and the network does not exist",
        NetworkErrorCode.NetworkSetupMissing,
      );
    return this.network.addNode(nodeId, ip);
  }

  async end() {
    await this.network?.remove();
    await this.logger?.debug("Network Service has been stopped");
  }
}
