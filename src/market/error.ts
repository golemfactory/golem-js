import { GolemModuleError } from "../error/golem-error";
import { Demand } from "./demand";

export enum MarketErrorCode {
  ServiceNotInitialized = "ServiceNotInitialized",
  MissingAllocation = "MissingAllocation",
  SubscriptionFailed = "SubscriptionFailed",
  InvalidProposal = "InvalidProposal",
  ProposalResponseFailed = "ProposalResponseFailed",
  ProposalRejectionFailed = "ProposalRejectionFailed",
  DemandExpired = "DemandExpired",
  AgreementTerminationFailed = "AgreementTerminationFailed",
  AgreementCreationFailed = "AgreementCreationFailed",
  AgreementApprovalFailed = "AgreementApprovalFailed",
  NoProposalAvailable = "NoProposalAvailable",
}

export class GolemMarketError extends GolemModuleError {
  #demand?: Demand;
  constructor(
    message: string,
    public code: MarketErrorCode,
    demand?: Demand,
    public previous?: Error,
  ) {
    super(message, code, previous);
    this.#demand = demand;
  }
  public getDemand(): Demand | undefined {
    return this.#demand;
  }
}
