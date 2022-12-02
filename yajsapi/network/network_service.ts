import { EventBus } from "../events/event_bus";
import { Logger } from "../utils";
import { Network } from "./index";
import { YagnaOptions } from "../executor";

export interface NetworkOptions {
  yagnaOptions?: YagnaOptions;
  logger?: Logger;
}
export class NetworkService {
  private network?: Network;
  private logger?: Logger;

  constructor(options?: NetworkOptions) {
    this.logger = options?.logger;
  }

  async run(address: string) {
    this.logger?.debug("Network Service has started");
    // const api = {}
    // this.network = await Network.create(api, address, this.options.identity, this.logger);
    // this.eventBus.on("TODO - Agreement with new Provider", this.addNode.bind(this));
  }

  public async addNode(nodeId: string, ip?: string) {
    // return this.network?.add_node(nodeId, ip);
  }

  async end() {
    this.logger?.debug("Network Service has been stopped");
  }
}
