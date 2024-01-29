import { GolemModuleError } from "../error/golem-error";
import { Demand } from "./demand";

export enum MarketErrorCode {
  ServiceNotInitialized,
  MissingAllocation,
  SubscriptionFailed,
  InvalidProposal,
  ProposalResponseFailed,
  ProposalRejectionFailed,
  DemandExpired,
  AgreementTerminationFailed,
  AgreementCreationFailed,
  AgreementApprovalFailed,
}

export class GolemMarketError extends GolemModuleError {
  constructor(
    message: string,
    public code: MarketErrorCode,
    public demand?: Demand,
    public previous?: Error,
  ) {
    super(message, code, previous);
  }
}
