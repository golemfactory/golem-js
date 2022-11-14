import { Logger } from "../utils";
import { EventBus } from "../events/event_bus";

export class MarketService {
  constructor(
    private readonly yagnaOptions: { apiKey?: string; apiUrl?: string },
    private readonly eventBus: EventBus,
    private readonly logger?: Logger
  ) {}
  async run(taskPackage) {
    // todo
  }

  async end() {
    // todo
  }
}
