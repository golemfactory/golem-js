export enum RejectionReason {
  UnsolicitedService = "UNSOLICITED_SERVICE",
  BadService = "BAD_SERVICE",
  IncorrectAmount = "INCORRECT_AMOUNT",
  RejectedByRequestorFilter = "REJECTED_BY_REQUESTOR_FILTER",

  /**
   * Use it when you're processing an event after the agreement reached it's "final state"
   *
   * By final state we mean: we got an invoice for that agreement
   */
  AgreementFinalized = "AGREEMENT_FINALIZED",
}

export interface Rejection {
  rejectionReason: RejectionReason;
  totalAmountAccepted: string;
  message?: string;
}
