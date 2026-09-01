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

/**
 * The Provider announced its intention to terminate the agreement. The
 * agreement stays approved and running activities may continue during the
 * grace period, but finish or migrate your work by `terminationDeadline` -
 * after that the Provider may terminate the agreement.
 */
export type AgreementTerminationNoticeEvent = {
  type: "AgreementTerminationNotice";
  agreement: Agreement;
  terminationDeadline: Date;
  reason: string;
  timestamp: Date;
};

export type AgreementEvent =
  | AgreementApproved
  | AgreementTerminatedEvent
  | AgreementRejectedEvent
  | AgreementCancelledEvent
  | AgreementTerminationNoticeEvent;
