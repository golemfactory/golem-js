import { EventBus } from "../executor/event_bus";
import { Logger } from "../utils";

export class PaymentService {
  constructor(private eventBus: EventBus, logger?: Logger) {}
  async run() {
    this.process_debit_notes();
    this.process_invoices();
  }
  acceptPayments(agreementId: string) {
    this.accept_payment_for_agreement({ agreement_id: agreementId, partial: false });
  }
  // TODO: old references - to refactor
  async accept_payment_for_agreement({ agreement_id, partial }) {
    // only reference mocked
  }
  async process_debit_notes() {
    // only reference mocked
  }
  async process_invoices() {
    // only reference mocked
  }
}
