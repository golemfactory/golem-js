import { EventEmitter } from "eventemitter3";
import { Agreement } from "./agreement";
import { Demand, DraftOfferProposalPool, IMarketApi, MarketEvents, MarketProposalEvent, OfferProposalSelector } from "./index";
import { Logger, YagnaApi } from "../shared/utils";
import { Allocation, IPaymentApi } from "../payment";
import { Observable } from "rxjs";
import { OfferCounterProposal, OfferProposal, OfferProposalFilter } from "./proposal";
import { DemandBodyBuilder, DemandSpecification, OrderDemandOptions } from "./demand";
import { IActivityApi, IFileServer } from "../activity";
import { StorageProvider } from "../shared/storage";
import { MarketOrderSpec } from "../golem-network";
import { INetworkApi, NetworkModule } from "../network";
import { AgreementOptions } from "./agreement/agreement";
import { ScanOptions, ScanSpecification, ScannedOffer } from "./scan";
export type DemandEngine = "vm" | "vm-nvidia" | "wasmtime";
export type PricingOptions = {
    model: "linear";
    maxStartPrice: number;
    maxCpuPerHourPrice: number;
    maxEnvPerHourPrice: number;
} | {
    model: "burn-rate";
    avgGlmPerHour: number;
};
export interface OrderMarketOptions {
    /** How long you want to rent the resources in hours */
    rentHours: number;
    /** Pricing strategy that will be used to filter the offers from the market */
    pricing: PricingOptions;
    /** A user-defined filter function which will determine if the offer proposal is valid for use. */
    offerProposalFilter?: OfferProposalFilter;
    /** A user-defined function that will be used to pick the best fitting offer proposal from available ones */
    offerProposalSelector?: OfferProposalSelector;
}
export interface MarketModuleOptions {
    /**
     * Number of seconds after which the demand will be un-subscribed and subscribed again to get fresh
     * offers from the market
     *
     * @default 30 minutes
     */
    demandRefreshIntervalSec: number;
}
export interface MarketModule {
    events: EventEmitter<MarketEvents>;
    /**
     * Build a DemandSpecification based on the given options and allocation.
     * You can obtain an allocation using the payment module.
     * The method returns a DemandSpecification that can be used to publish the demand to the market,
     * for example using the `publishDemand` method.
     */
    buildDemandDetails(demandOptions: OrderDemandOptions, orderOptions: OrderMarketOptions, allocation: Allocation): Promise<DemandSpecification>;
    /**
     * Build a ScanSpecification that can be used to scan the market for offers.
     * The difference between this method and `buildDemandDetails` is that this method does not require an
     * allocation, doesn't inherit payment properties from `GolemNetwork` settings and doesn't provide any defaults.
     * If you wish to set the payment platform, you need to specify it in the ScanOptions.
     */
    buildScanSpecification(options: ScanOptions): ScanSpecification;
    /**
     * Publishes the demand to the market and handles refreshing it when needed.
     * Each time the demand is refreshed, a new demand is emitted by the observable.
     * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
     * Unsubscribing will remove the demand from the market.
     */
    publishAndRefreshDemand(demandSpec: DemandSpecification): Observable<Demand>;
    /**
     * Return an observable that will emit values representing various events related to this demand
     */
    collectMarketProposalEvents(demand: Demand): Observable<MarketProposalEvent>;
    /**
     * Subscribes to the proposals for the given demand.
     * If an error occurs, the observable will emit an error and complete.
     * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
     *
     * This method will just yield all the proposals that will be found for that demand without any additional logic.
     *
     * The {@link collectDraftOfferProposals} is a more specialized variant of offer collection, which includes negotiations
     *  and demand re-subscription logic
     */
    collectAllOfferProposals(demand: Demand): Observable<OfferProposal>;
    /**
     * Sends a counter-offer to the provider. Note that to get the provider's response to your
     * counter you should listen to events returned by `collectDemandOfferEvents`.
     *
     * @returns The counter-proposal that the requestor made to the Provider
     */
    negotiateProposal(receivedProposal: OfferProposal, counterDemandSpec: DemandSpecification): Promise<OfferCounterProposal>;
    /**
     * Internally
     *
     * - ya-ts-client createAgreement
     * - ya-ts-client approveAgreement
     * - ya-ts-client "wait for approval"
     *
     * @param proposal
     *
     * @return Returns when the provider accepts the agreement, rejects otherwise. The resulting agreement is ready to create activities from.
     */
    proposeAgreement(proposal: OfferProposal): Promise<Agreement>;
    /**
     * @return The Agreement that has been terminated via Yagna
     */
    terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement>;
    /**
     * Acquire a proposal from the pool and sign an agreement with the provider. If signing the agreement fails,
     * destroy the proposal and try again with another one. The method returns an agreement that's ready to be used.
     * Optionally, you can provide a timeout in milliseconds or an AbortSignal that can be used to cancel the operation
     * early. If the operation is cancelled, the method will throw an error.
     * Note that this method will respect the acquire timeout set in the pool and will throw an error if no proposal
     * is available within the specified time.
     *
     * @example
     * ```ts
     * const agreement = await marketModule.signAgreementFromPool(draftProposalPool, 10_000); // throws TimeoutError if the operation takes longer than 10 seconds
     * ```
     * @example
     * ```ts
     * const signal = AbortSignal.timeout(10_000);
     * const agreement = await marketModule.signAgreementFromPool(draftProposalPool, signal); // throws TimeoutError if the operation takes longer than 10 seconds
     * ```
     * @param draftProposalPool - The pool of draft proposals to acquire from
     * @param agreementOptions - options used to sign the agreement such as expiration or waitingForApprovalTimeout
     * @param signalOrTimeout - The timeout in milliseconds or an AbortSignal that will be used to cancel the operation
     */
    signAgreementFromPool(draftProposalPool: DraftOfferProposalPool, agreementOptions?: AgreementOptions, signalOrTimeout?: number | AbortSignal): Promise<Agreement>;
    /**
     * Creates a demand for the given package and allocation and starts collecting, filtering and negotiating proposals.
     * The method returns an observable that emits a batch of draft proposals every time the buffer is full.
     * The method will automatically negotiate the proposals until they are moved to the `Draft` state.
     * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
     * Unsubscribing from the observable will stop the process and remove the demand from the market.
     */
    collectDraftOfferProposals(options: {
        demandSpecification: DemandSpecification;
        pricing: PricingOptions;
        filter?: OfferProposalFilter;
        minProposalsBatchSize?: number;
        proposalsBatchReleaseTimeoutMs?: number;
    }): Observable<OfferProposal>;
    /**
     * Estimate the budget for the given order and maximum numbers of agreemnets.
     * Keep in mind that this is just an estimate and the actual cost may vary.
     * The method returns the estimated budget in GLM.
     * @param params
     */
    estimateBudget({ maxAgreements, order }: {
        maxAgreements: number;
        order: MarketOrderSpec;
    }): number;
    /**
     * Fetch the most up-to-date agreement details from the yagna
     */
    fetchAgreement(agreementId: string): Promise<Agreement>;
    /**
     * Scan the market for offers that match the given demand specification.
     */
    scan(scanSpecification: ScanSpecification): Observable<ScannedOffer>;
}
/**
 * Represents a director that can instruct DemandDetailsBuilder
 *
 * Demand is a complex concept in Golem. Requestors can place arbitrary properties and constraints on such
 * market entity. While the demand request on the Golem Protocol level is a flat list of properties (key, value) and constraints,
 * from the Requestor side they form logical groups that make sense together.
 *
 * The idea behind Directors is that you can encapsulate this grouping knowledge along with validation logic etc to prepare
 * all the final demand request body properties in a more controlled and organized manner.
 */
export interface IDemandDirector {
    apply(builder: DemandBodyBuilder): Promise<void> | void;
}
export declare class MarketModuleImpl implements MarketModule {
    private readonly deps;
    events: EventEmitter<MarketEvents, any>;
    private readonly logger;
    private readonly marketApi;
    private fileServer;
    private options;
    constructor(deps: {
        logger: Logger;
        yagna: YagnaApi;
        paymentApi: IPaymentApi;
        activityApi: IActivityApi;
        marketApi: IMarketApi;
        networkApi: INetworkApi;
        networkModule: NetworkModule;
        fileServer: IFileServer;
        storageProvider: StorageProvider;
    }, options?: Partial<MarketModuleOptions>);
    buildDemandDetails(demandOptions: OrderDemandOptions, orderOptions: OrderMarketOptions, allocation: Allocation): Promise<DemandSpecification>;
    buildScanSpecification(options: ScanOptions): ScanSpecification;
    /**
     * Augments the user-provided options with additional logic
     *
     * Use Case: serve the GVMI from the requestor and avoid registry
     */
    private applyLocalGVMIServeSupport;
    /**
     * Publishes the specified demand and re-publishes it based on demandSpecification.expirationSec interval
     */
    publishAndRefreshDemand(demandSpecification: DemandSpecification): Observable<Demand>;
    collectMarketProposalEvents(demand: Demand): Observable<MarketProposalEvent>;
    collectAllOfferProposals(demand: Demand): Observable<OfferProposal>;
    negotiateProposal(offerProposal: OfferProposal, counterDemand: DemandSpecification): Promise<OfferCounterProposal>;
    proposeAgreement(proposal: OfferProposal, options?: AgreementOptions): Promise<Agreement>;
    terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement>;
    collectDraftOfferProposals(options: {
        demandSpecification: DemandSpecification;
        pricing: PricingOptions;
        filter?: OfferProposalFilter;
        minProposalsBatchSize?: number;
        proposalsBatchReleaseTimeoutMs?: number;
    }): Observable<OfferProposal>;
    private emitMarketProposalEvents;
    signAgreementFromPool(draftProposalPool: DraftOfferProposalPool, agreementOptions?: AgreementOptions, signalOrTimeout?: number | AbortSignal): Promise<Agreement>;
    /**
     * Reduce initial proposals to a set grouped by the provider's key to avoid duplicate offers
     */
    private reduceInitialProposalsByProviderKey;
    estimateBudget({ order, maxAgreements }: {
        order: MarketOrderSpec;
        maxAgreements: number;
    }): number;
    fetchAgreement(agreementId: string): Promise<Agreement>;
    /**
     * Subscribes to an observable that maps yagna events into our domain events
     * and emits these domain events via EventEmitter
     */
    private collectAndEmitAgreementEvents;
    private filterProposalsByUserFilter;
    private filterProposalsByPricingOptions;
    scan(scanSpecification: ScanSpecification): Observable<ScannedOffer>;
}
