import { Logger } from '../utils/index.js';
import { Network } from './index.js';
import { NetworkOptions } from './network.js';
import { NetworkNode } from './node.js';
import { getIdentity } from './identity.js';

export type NetworkServiceOptions = Omit<NetworkOptions, "networkOwnerId">;

/**
 * Network Service
 * @description Service used in {@link TaskExecutor}
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
