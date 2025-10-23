import { ActivityModule } from "../activity";
import { Agreement, DraftOfferProposalPool, MarketModule } from "../market";
import { NetworkModule } from "../network";
import { Allocation, PaymentModule } from "../payment";
import { StorageProvider } from "../shared/storage";
import { Logger } from "../shared/utils";
import { ResourceRental, ResourceRentalOptions } from "./resource-rental";
import { ResourceRentalPool, ResourceRentalPoolOptions } from "./resource-rental-pool";
import { EventEmitter } from "eventemitter3";
export interface ResourceRentalModuleEvents {
    /** Emitted when ResourceRenatl is successfully created */
    resourceRentalCreated: (agreement: Agreement) => void;
    /** Emitted when ResourceRenatlPool is successfully created */
    resourceRentalPoolCreated: () => void;
}
export interface RentalModule {
    events: EventEmitter<ResourceRentalModuleEvents>;
    /**
     * Factory that creates a new resource rental that's fully configured.
     * This method will also create the payment process for the agreement.
     *
     */
    createResourceRental(agreement: Agreement, allocation: Allocation, options?: ResourceRentalOptions): ResourceRental;
    /**
     * Factory that creates new resource rental pool that's fully configured
     */
    createResourceRentalPool(draftPool: DraftOfferProposalPool, allocation: Allocation, options: ResourceRentalPoolOptions): ResourceRentalPool;
}
export declare class RentalModuleImpl implements RentalModule {
    private readonly deps;
    events: EventEmitter<ResourceRentalModuleEvents, any>;
    constructor(deps: {
        marketModule: MarketModule;
        paymentModule: PaymentModule;
        activityModule: ActivityModule;
        networkModule: NetworkModule;
        storageProvider: StorageProvider;
        logger: Logger;
    });
    createResourceRental(agreement: Agreement, allocation: Allocation, options?: ResourceRentalOptions): ResourceRental;
    createResourceRentalPool(draftPool: DraftOfferProposalPool, allocation: Allocation, options?: ResourceRentalPoolOptions): ResourceRentalPool;
}
