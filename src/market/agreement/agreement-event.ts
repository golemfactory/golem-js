import { Agreement } from "./agreement";

export type AgreementApproved = {
  type: "AgreementApproved";
  agreement: Agreement;
  timestamp: Date;
};

export type AgreementTerminatedEvent = {
  type: "AgreementTerminated";
  terminatedBy: "Provider" | "Requestor";
  reason: string;
  agreement: Agreement;
  timestamp: Date;
};

export type AgreementRejectedEvent = {
  type: "AgreementRejected";
  agreement: Agreement;
  reason: string;
  timestamp: Date;
};

export type AgreementCancelledEvent = {
  type: "AgreementCancelled";
  agreement: Agreement;
  timestamp: Date;
};

export type AgreementEvent =
  | AgreementApproved
  | AgreementTerminatedEvent
  | AgreementRejectedEvent
  | AgreementCancelledEvent;
