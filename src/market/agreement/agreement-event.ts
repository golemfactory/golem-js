import { Agreement } from "./agreement";

interface AgreementEvent {
  /** The agreement related to the event in its most recent state */
  agreement: Agreement;
  timestamp: Date;
}

export class AgreementConfirmedEvent implements AgreementEvent {
  constructor(
    public readonly agreement: Agreement,
    public readonly timestamp: Date,
  ) {}
}

export class AgreementTerminatedEvent implements AgreementEvent {
  constructor(
    public readonly agreement: Agreement,
    public readonly timestamp: Date,
    public readonly terminatedBy: string,
    public readonly reason: string,
  ) {}
}

export class AgreementRejectedEvent implements AgreementEvent {
  constructor(
    public readonly agreement: Agreement,
    public readonly timestamp: Date,
    public readonly reason: string,
  ) {}
}

export class AgreementCancelledEvent implements AgreementEvent {
  constructor(
    public readonly agreement: Agreement,
    public readonly timestamp: Date,
  ) {}
}
