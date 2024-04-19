import { GolemModuleError } from "../shared/error/golem-error";
import { Demand, DemandNew } from "./demand";

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
  #demand?: DemandNew | Demand;

  constructor(
    message: string,
    public code: MarketErrorCode,
    demand?: DemandNew | Demand,
    public previous?: Error,
  ) {
    super(message, code, previous);
    this.#demand = demand;
  }

  public getDemand(): DemandNew | Demand | undefined {
    return this.#demand;
  }
}
