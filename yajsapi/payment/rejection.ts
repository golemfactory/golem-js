export enum RejectionReason {
  UnsolicitedService = "UNSOLICITED_SERVICE",
  BadService = "BAD_SERVICE",
  IncorrectAmount = "INCORRECT_AMOUNT",
}

export interface Rejection {
  rejectionReason: RejectionReason;
  totalAmountAccepted: string;
  message?: string;
}
