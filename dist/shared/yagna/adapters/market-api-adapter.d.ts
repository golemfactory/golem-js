import { Observable } from "rxjs";
import { Agreement, AgreementEvent, AgreementState, Demand, DemandSpecification, IMarketApi, MarketProposalEvent, OfferProposal } from "../../../market";
import { YagnaApi } from "../yagnaApi";
import { Logger } from "../../utils";
import { DemandBodyPrototype, IDemandRepository } from "../../../market/demand";
import { AgreementOptions, IAgreementRepository } from "../../../market/agreement/agreement";
import { IProposalRepository, OfferCounterProposal } from "../../../market/proposal";
import { ScanSpecification, ScannedOffer } from "../../../market/scan";
/**
 * A bit more user-friendly type definition of DemandOfferBaseDTO from ya-ts-client
 *
 * That's probably one of the most confusing elements around Golem Protocol and the API specificiation:
 *
 * - Providers create Offers
 * - Requestors create Demands
 * - Demands are used to create a subscription for Proposals - Initial ones reflect the Offer that was matched with the Demand used to subscribe
 * - Once the proposal is countered, it's countered with a "counter proposal" which is no longer Offer + Demand,
 *   but rather a sketch of the agreement - here both parties try to agree on the values of certain properties that
 *   are interesting from their perspective. These "negotiated proposals (of) ...." are buit using DemandOffeBaseDTO
 *
 * #FIXME yagna - feedback in the note above
 */
export type DemandRequestBody = {
    properties: Record<string, string | number | boolean | string[] | number[]>;
    constraints: string;
};
export declare class MarketApiAdapter implements IMarketApi {
    private readonly yagnaApi;
    private readonly agreementRepo;
    private readonly proposalRepo;
    private readonly demandRepo;
    private readonly logger;
    constructor(yagnaApi: YagnaApi, agreementRepo: IAgreementRepository, proposalRepo: IProposalRepository, demandRepo: IDemandRepository, logger: Logger);
    publishDemandSpecification(spec: DemandSpecification): Promise<Demand>;
    unpublishDemand(demand: Demand): Promise<void>;
    collectMarketProposalEvents(demand: Demand): Observable<MarketProposalEvent>;
    counterProposal(receivedProposal: OfferProposal, demand: DemandSpecification): Promise<OfferCounterProposal>;
    rejectProposal(receivedProposal: OfferProposal, reason: string): Promise<void>;
    private buildDemandRequestBody;
    getPaymentRelatedDemandDecorations(allocationId: string): Promise<DemandBodyPrototype>;
    confirmAgreement(agreement: Agreement, options?: AgreementOptions): Promise<Agreement>;
    createAgreement(proposal: OfferProposal, options?: AgreementOptions): Promise<Agreement>;
    proposeAgreement(proposal: OfferProposal, options?: AgreementOptions): Promise<Agreement>;
    getAgreement(id: string): Promise<Agreement>;
    getAgreementState(id: string): Promise<AgreementState>;
    terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement>;
    collectAgreementEvents(): Observable<AgreementEvent>;
    private isOfferCounterProposal;
    scan(spec: ScanSpecification): Observable<ScannedOffer>;
}
