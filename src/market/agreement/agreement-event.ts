import { Agreement } from "./agreement";

export type AgreementEvent =
  | {
      type: "AgreementConfirmed";
      agreement: Agreement;
      timestamp: Date;
    }
  | {
      type: "AgreementTerminated";
      terminatedBy: "Provider" | "Requestor";
      reason: string;
      agreement: Agreement;
      timestamp: Date;
    }
  | {
      type: "AgreementRejected";
      agreement: Agreement;
      reason: string;
      timestamp: Date;
    }
  | {
      type: "AgreementCancelled";
      agreement: Agreement;
      timestamp: Date;
    };
