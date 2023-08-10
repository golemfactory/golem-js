import { Logger } from "../utils/index";
import { Network } from "./index";
import { NetworkOptions } from "./network";
import { NetworkNode } from "./node";
import { getIdentity } from "./identity";

/**
 * @internal
 */
export type NetworkServiceOptions = Omit<NetworkOptions, "networkOwnerId">;

/**
 * Network Service
 * @description Service used in {@link TaskExecutor}
 * @internal
 */
export class NetworkService {
  private network?: Network;
  private logger?: Logger;

  constructor(private options?: NetworkServiceOptions) {
    this.logger = options?.logger;
  }

  async run(networkOwnerId?: string) {
    if (!networkOwnerId) networkOwnerId = await getIdentity(this.options);
    this.network = await Network.create({ ...this.options, networkOwnerId });
    this.logger?.debug("Network Service has started");
  }

  public async addNode(nodeId: string, ip?: string): Promise<NetworkNode> {
    if (!this.network) throw new Error("The service is not started and the network does not exist");
    return this.network.addNode(nodeId, ip);
  }

  async end() {
    await this.network?.remove();
    await this.logger?.debug("Network Service has been stopped");
  }
}
