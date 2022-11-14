import { EventBus } from "../events/event_bus";
import { Logger } from "../utils";

export class PaymentService {
  constructor(
    private readonly yagnaOptions: { apiKey?: string; apiUrl?: string },
    private readonly eventBus: EventBus,
    private readonly logger?: Logger
  ) {}
  async run() {
    this.logger?.info("The Payment Service has started");
  }
  acceptPayments(agreementId: string) {}

  async end() {
    // todo
  }
}
