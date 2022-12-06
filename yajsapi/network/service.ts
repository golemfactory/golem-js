import { Logger } from "../utils";
import { Network } from "./index";
import { NetworkOptions } from "./network";
import { NetworkNode } from "./node";
import { getIdentity } from "./identity";

export type NetworkServiceOptions = Omit<NetworkOptions, "ownerId">;

export class NetworkService {
  private network?: Network;
  private logger?: Logger;

  constructor(private options?: NetworkServiceOptions) {
    this.logger = options?.logger;
  }

  async run(ownerId?: string) {
    if (!ownerId) ownerId = await getIdentity(this.options);
    this.network = await Network.create({ ...this.options, ownerId });
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
