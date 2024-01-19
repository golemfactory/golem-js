import { Logger, YagnaApi, defaultLogger } from "../utils";
import { Network } from "./index";
import { NetworkOptions } from "./network";
import { NetworkNode } from "./node";
import { GolemError } from "../error/golem-error";

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
    if (!this.network) throw new GolemError("The service is not started and the network does not exist");
    return this.network.addNode(nodeId, ip);
  }

  async end() {
    await this.network?.remove();
    this.logger.info("Network Service has been stopped");
  }
}
