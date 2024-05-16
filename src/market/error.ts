import { GolemModuleError } from "../shared/error/golem-error";

export enum MarketErrorCode {
  ServiceNotInitialized = "ServiceNotInitialized",
  MissingAllocation = "MissingAllocation",
  SubscriptionFailed = "SubscriptionFailed",
  InvalidProposal = "InvalidProposal",
  ProposalResponseFailed = "ProposalResponseFailed",
  ProposalRejectionFailed = "ProposalRejectionFailed",
  DemandExpired = "DemandExpired",
  LeaseProcessTerminationFailed = "LeaseProcessTerminationFailed",
  LeaseProcessCreationFailed = "LeaseProcessCreationFailed",
  AgreementApprovalFailed = "AgreementApprovalFailed",
  NoProposalAvailable = "NoProposalAvailable",
}

export class GolemMarketError extends GolemModuleError {
  constructor(
    message: string,
    public code: MarketErrorCode,
    public previous?: Error,
  ) {
    super(message, code, previous);
  }
}
