import { GolemModuleError } from "../shared/error/golem-error";
export declare enum MarketErrorCode {
    CouldNotGetAgreement = "CouldNotGetAgreement",
    CouldNotGetProposal = "CouldNotGetProposal",
    ServiceNotInitialized = "ServiceNotInitialized",
    MissingAllocation = "MissingAllocation",
    SubscriptionFailed = "SubscriptionFailed",
    InvalidProposal = "InvalidProposal",
    ProposalResponseFailed = "ProposalResponseFailed",
    ProposalRejectionFailed = "ProposalRejectionFailed",
    DemandExpired = "DemandExpired",
    ResourceRentalTerminationFailed = "ResourceRentalTerminationFailed",
    ResourceRentalCreationFailed = "ResourceRentalCreationFailed",
    AgreementApprovalFailed = "AgreementApprovalFailed",
    NoProposalAvailable = "NoProposalAvailable",
    InternalError = "InternalError",
    ScanFailed = "ScanFailed"
}
export declare class GolemMarketError extends GolemModuleError {
    code: MarketErrorCode;
    previous?: Error | undefined;
    constructor(message: string, code: MarketErrorCode, previous?: Error | undefined);
}
