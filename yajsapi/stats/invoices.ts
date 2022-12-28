import { AbstractAggregator } from "./abstract_aggregator";
import { Events } from "../events";

export interface InvoiceInfo {
  id: string;
  providerId: string;
  agreementId: string;
  amount: number;
}

export class Invoices extends AbstractAggregator<Events.InvoiceReceived, InvoiceInfo> {
  beforeAdd(event: Events.InvoiceReceived): InvoiceInfo {
    return {
      ...event.detail,
      amount: parseFloat(event.detail.amount),
    };
  }
}
