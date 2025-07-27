import type { Agreement, DraftOfferProposalPool, MarketModule } from "../market";
import { GolemMarketError } from "../market";
import type { Logger } from "../shared/utils";
import { EventEmitter } from "eventemitter3";
import type { RequireAtLeastOne } from "../shared/utils/types";
import type { Allocation } from "../payment";
import type { ResourceRental, ResourceRentalOptions } from "./resource-rental";
import { Network, NetworkModule } from "../network";
import { RentalModule } from "./rental.module";
import { AgreementOptions } from "../market/agreement/agreement";
export interface ResourceRentalPoolDependencies {
    allocation: Allocation;
    proposalPool: DraftOfferProposalPool;
    marketModule: MarketModule;
    networkModule: NetworkModule;
    rentalModule: RentalModule;
    logger: Logger;
}
export type PoolSize = number | RequireAtLeastOne<{
    min: number;
    max: number;
}>;
export interface ResourceRentalPoolOptions {
    poolSize?: PoolSize;
    network?: Network;
    resourceRentalOptions?: ResourceRentalOptions;
    agreementOptions?: AgreementOptions;
}
export interface ResourceRentalPoolEvents {
    /** Triggered when the pool has the minimal number of rentals prepared for operations */
    ready: () => void;
    /** Triggered when the pool is emptied from all rentals */
    end: () => void;
    acquired: (event: {
        agreement: Agreement;
    }) => void;
    released: (event: {
        agreement: Agreement;
    }) => void;
    created: (event: {
        agreement: Agreement;
    }) => void;
    errorDestroyingRental: (event: {
        agreement: Agreement;
        error: GolemMarketError;
    }) => void;
    destroyed: (event: {
        agreement: Agreement;
    }) => void;
    errorCreatingRental: (event: {
        error: GolemMarketError;
    }) => void;
    /** Triggered when the pool enters the "draining" state */
    draining: () => void;
}
/**
 * Pool of resource rentals that can be borrowed, released or destroyed.
 */
export declare class ResourceRentalPool {
    readonly events: EventEmitter<ResourceRentalPoolEvents, any>;
    /**
     * Pool of resource rentals that do not have an activity
     */
    private lowPriority;
    /**
     * Pool of resource rentals that have an activity
     */
    private highPriority;
    private borrowed;
    /**
     * Queue of functions that are waiting for a lease process to be available
     */
    private acquireQueue;
    private logger;
    private drainPromise?;
    private abortController;
    private allocation;
    private network?;
    private proposalPool;
    private marketModule;
    private networkModule;
    private rentalModule;
    private readonly minPoolSize;
    private readonly maxPoolSize;
    private readonly resourceRentalOptions?;
    private readonly agreementOptions?;
    private asyncLock;
    /**
     * Number of resource rentals that are currently being signed.
     * This is used to prevent creating more resource rentals than the pool size allows.
     */
    private rentalsBeingSigned;
    constructor(options: ResourceRentalPoolOptions & ResourceRentalPoolDependencies);
    private createNewResourceRental;
    private validate;
    private canCreateMoreResourceRentals;
    /**
     * Take the first valid resource rental from the pool
     * If there is no valid resource rental, return null
     */
    private takeValidResourceRental;
    private enqueueAcquire;
    /**
     * Sign a new resource rental or wait for one to become available in the pool,
     * whichever comes first.
     */
    private raceNewRentalWithAcquireQueue;
    /**
     * Borrow a resource rental from the pool.
     * If there is no valid resource rental a new one will be created.
     * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the rental request
     */
    acquire(signalOrTimeout?: number | AbortSignal): Promise<ResourceRental>;
    /**
     * If there are any acquires waiting in the queue, the resource rental will be passed to the first one.
     * Otherwise, the resource rental will be added to the queue.
     */
    private passResourceRentalToWaitingAcquireOrBackToPool;
    release(resourceRental: ResourceRental): Promise<void>;
    destroy(resourceRental: ResourceRental): Promise<void>;
    private get isDraining();
    private startDrain;
    /**
     * Sets the pool into draining mode and then clears it
     *
     * When set to drain mode, no new acquires will be possible. At the same time, all agreements in the pool will be terminated with the Providers.
     *
     * @return Resolves when all agreements are terminated
     */
    drainAndClear(): Promise<void>;
    /**
     * Total size (available + borrowed)
     */
    getSize(): number;
    /**
     * Available size (how many resource rental are ready to be borrowed)
     */
    getAvailableSize(): number;
    /**
     * Borrowed size (how many resource rental are currently out of the pool)
     */
    getBorrowedSize(): number;
    /**
     * Wait till the pool is ready to use (min number of items in pool are usable).
     * If an error occurs while creating new resource rentals, it will be retried until the pool is ready
     * (potentially indefinitely). To stop this process if it fails to reach the desired state in a given time,
     * you can pass either a timeout in milliseconds or an AbortSignal.
     *
     * @example
     * ```typescript
     * await pool.ready(10_000); // If the pool is not ready in 10 seconds, an error will be thrown
     * ```
     * @example
     * ```typescript
     * await pool.ready(AbortSignal.timeout(10_000)); // If the pool is not ready in 10 seconds, an error will be thrown
     * ```
     */
    ready(timeoutMs?: number): Promise<void>;
    ready(abortSignal?: AbortSignal): Promise<void>;
    private removeNetworkNode;
    /**
     * Acquire a resource rental from the pool and release it after the callback is done
     * @example
     * ```typescript
     * const result = await pool.withRental(async (rental) => {
     *  // Do something with the rented resources
     *  return result;
     *  // pool.release(rental) is called automatically
     *  // even if an error is thrown in the callback
     * });
     * ```
     * @param callback - a function that takes a `rental` object as its argument. The rental is automatically released after the callback is executed, regardless of whether it completes successfully or throws an error.
     * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the rental request
     */
    withRental<T>(callback: (rental: ResourceRental) => Promise<T>, signalOrTimeout?: number | AbortSignal): Promise<T>;
}
