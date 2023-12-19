/**
 * @hidden
 */
export enum RejectionReason {
  UnsolicitedService = "UNSOLICITED_SERVICE",
  BadService = "BAD_SERVICE",
  IncorrectAmount = "INCORRECT_AMOUNT",
  /**
   * We might get a debit note related to an agreement which is already covered with
   * a final invoice. In such cases we don't want to pay for the debit note,
   * as the payment will be already made when we accept the invoice.
   */
  NonPayableAgreement = "NON_PAYABLE_AGREEMENT",
  Duplicate = "DUPLICATE",
  RejectedByRequestorFilter = "REJECTED_BY_REQUESTOR_FILTER",
  AlreadyAccepted = "ALREADY_ACCEPTED",
  AgreementFinalized = "AGREEMENT_FINALIZED",
}

/**
 * @hidden
 */
export interface Rejection {
  rejectionReason: RejectionReason;
  totalAmountAccepted: string;
  message?: string;
}
