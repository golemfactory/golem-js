import { Logger } from "../utils";
import { Network } from "./index";
import { NetworkOptions } from "./network";
import { NetworkNode } from "./node";

export class NetworkService {
  private network?: Network;
  private logger?: Logger;

  constructor(private options: NetworkOptions) {
    this.logger = options?.logger;
  }

  async run() {
    this.network = await Network.create(this.options);
    this.logger?.debug("Network Service has started");
  }

  public async addNode(nodeId: string, ip?: string): Promise<NetworkNode> {
    if (!this.network) throw new Error("There is no network");
    return this.network.addNode(nodeId, ip);
  }

  async end() {
    await this.network?.remove();
    await this.logger?.debug("Network Service has been stopped");
  }
}
