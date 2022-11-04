import { EventBus } from "../executor/event_bus";
import { Logger } from "../utils";
import { Network } from "./index";

export class NetworkService {
  private network?: Network;
  constructor(private options, private eventBus: EventBus, private logger?: Logger) {}

  async run() {
    this.network = await Network.create(this.options.api, this.options.address, this.options.identity, this.logger);
    this.eventBus.on("TODO - Agreement with new Provider", this.addNode.bind(this));
  }

  public async addNode(nodeId: string, ip?: string) {
    return this.network?.add_node(nodeId, ip);
  }
}
