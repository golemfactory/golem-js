import type { Agreement, DraftOfferProposalPool, MarketModule } from "../market";
import { GolemMarketError, MarketErrorCode } from "../market";
import type { Logger } from "../shared/utils";
import { anyAbortSignal, createAbortSignalFromTimeout, runOnNextEventLoopIteration } from "../shared/utils";
import { EventEmitter } from "eventemitter3";
import type { RequireAtLeastOne } from "../shared/utils/types";
import type { Allocation } from "../payment";
import type { ResourceRental, ResourceRentalOptions } from "./resource-rental";
import { Network, NetworkModule } from "../network";
import { RentalModule } from "./rental.module";
import { AgreementOptions } from "../market/agreement/agreement";
import { GolemAbortError } from "../shared/error/golem-error";

export interface ResourceRentalPoolDependencies {
  allocation: Allocation;
  proposalPool: DraftOfferProposalPool;
  marketModule: MarketModule;
  networkModule: NetworkModule;
  rentalModule: RentalModule;
  logger: Logger;
}

export type PoolSize = number | RequireAtLeastOne<{ min: number; max: number }>;

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

  acquired: (agreement: Agreement) => void;
  released: (agreement: Agreement) => void;
  created: (agreement: Agreement) => void;
  destroyed: (agreement: Agreement) => void;

  /** Fired when the pool will encounter an error */
  error: (error: GolemMarketError) => void;

  /** Triggered when the pool enters the "draining" state */
  draining: () => void;
}

const MAX_POOL_SIZE = 100;

/**
 * Pool of resource rentals that can be borrowed, released or destroyed.
 */
export class ResourceRentalPool {
  public readonly events = new EventEmitter<ResourceRentalPoolEvents>();

  /**
   * Pool of resource rentals that do not have an activity
   */
  private lowPriority = new Set<ResourceRental>();
  /**
   * Pool of resource rentals that have an activity
   */
  private highPriority = new Set<ResourceRental>();
  private borrowed = new Set<ResourceRental>();
  /**
   * Queue of functions that are waiting for a lease process to be available
   */
  private acquireQueue: Array<(rental: ResourceRental) => void> = [];
  private logger: Logger;

  private drainPromise?: Promise<void>;
  private abortController: AbortController;

  private allocation: Allocation;
  private network?: Network;
  private proposalPool: DraftOfferProposalPool;
  private marketModule: MarketModule;
  private networkModule: NetworkModule;
  private rentalModule: RentalModule;
  private readonly minPoolSize: number;
  private readonly maxPoolSize: number;
  private readonly resourceRentalOptions?: ResourceRentalOptions;
  private readonly agreementOptions?: AgreementOptions;
  /**
   * Number of resource rentals that are currently being signed.
   * This is used to prevent creating more resource rentals than the pool size allows.
   */
  private rentalsBeingSigned = 0;

  constructor(options: ResourceRentalPoolOptions & ResourceRentalPoolDependencies) {
    this.allocation = options.allocation;
    this.proposalPool = options.proposalPool;
    this.marketModule = options.marketModule;
    this.rentalModule = options.rentalModule;
    this.networkModule = options.networkModule;
    this.network = options.network;
    this.resourceRentalOptions = options.resourceRentalOptions;
    this.agreementOptions = options.agreementOptions;

    this.logger = options.logger;

    this.minPoolSize =
      (() => {
        if (typeof options?.poolSize === "number") {
          return options?.poolSize;
        }
        if (typeof options?.poolSize === "object") {
          return options?.poolSize.min;
        }
      })() || 0;

    this.maxPoolSize =
      (() => {
        if (typeof options?.poolSize === "object") {
          return options?.poolSize.max;
        }
      })() || MAX_POOL_SIZE;

    this.abortController = new AbortController();
  }

  private async createNewResourceRental(signalOrTimeout?: number | AbortSignal) {
    this.logger.debug("Creating new resource rental to add to pool");
    const signal = anyAbortSignal(this.abortController.signal, createAbortSignalFromTimeout(signalOrTimeout));

    try {
      this.rentalsBeingSigned++;
      const agreement = await this.marketModule.signAgreementFromPool(this.proposalPool, this.agreementOptions, signal);
      const networkNode = this.network
        ? await this.networkModule.createNetworkNode(this.network, agreement.provider.id)
        : undefined;
      const resourceRental = this.rentalModule.createResourceRental(agreement, this.allocation, {
        networkNode,
        ...this.resourceRentalOptions,
      });
      this.events.emit("created", agreement);
      return resourceRental;
    } catch (error) {
      this.events.emit(
        "error",
        new GolemMarketError("Creating resource rental failed", MarketErrorCode.ResourceRentalCreationFailed, error),
      );
      this.logger.error("Creating resource rental failed", error);
      throw error;
    } finally {
      this.rentalsBeingSigned--;
    }
  }

  private async validate(resourceRental: ResourceRental) {
    try {
      const state = await resourceRental.fetchAgreementState();
      const result = state === "Approved";
      this.logger.debug("Validated resource rental in the pool", { result, state });
      return result;
    } catch (err) {
      this.logger.error("Something went wrong while validating resource rental, it will be destroyed", err);
      return false;
    }
  }

  private canCreateMoreResourceRentals() {
    return this.getSize() + this.rentalsBeingSigned < this.maxPoolSize;
  }

  /**
   * Take the first valid resource rental from the pool
   * If there is no valid resource rental, return null
   */
  private async takeValidResourceRental(): Promise<ResourceRental | null> {
    let resourceRental: ResourceRental | null = null;
    if (this.highPriority.size > 0) {
      resourceRental = this.highPriority.values().next().value as ResourceRental;
      this.highPriority.delete(resourceRental);
    } else if (this.lowPriority.size > 0) {
      resourceRental = this.lowPriority.values().next().value as ResourceRental;
      this.lowPriority.delete(resourceRental);
    }
    if (!resourceRental) {
      return null;
    }
    const isValid = await this.validate(resourceRental);
    if (!isValid) {
      await this.destroy(resourceRental);
      return this.takeValidResourceRental();
    }
    return resourceRental;
  }

  private async enqueueAcquire(): Promise<ResourceRental> {
    return new Promise((resolve) => {
      this.acquireQueue.push((resourceRental) => {
        this.borrowed.add(resourceRental);
        this.events.emit("acquired", resourceRental.agreement);
        resolve(resourceRental);
      });
    });
  }

  /**
   * Borrow a resource rental from the pool.
   * If there is no valid resource rental a new one will be created.
   * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the rental request
   */
  async acquire(signalOrTimeout?: number | AbortSignal): Promise<ResourceRental> {
    if (this.isDraining) {
      throw new GolemAbortError("The pool is in draining mode, you cannot acquire new resources");
    }

    let resourceRental = await this.takeValidResourceRental();

    if (!resourceRental) {
      if (!this.canCreateMoreResourceRentals()) {
        return this.enqueueAcquire();
      }
      resourceRental = await this.createNewResourceRental(signalOrTimeout);
    }

    this.borrowed.add(resourceRental);
    this.events.emit("acquired", resourceRental.agreement);

    return resourceRental;
  }

  /**
   * If there are any acquires waiting in the queue, the resource rental will be passed to the first one.
   * Otherwise, the resource rental will be added to the queue.
   */
  private passResourceRentalToWaitingAcquireOrBackToPool(resourceRental: ResourceRental) {
    if (this.acquireQueue.length > 0) {
      const acquire = this.acquireQueue.shift()!;
      acquire(resourceRental);
      return;
    }
    if (resourceRental.hasActivity()) {
      this.highPriority.add(resourceRental);
    } else {
      this.lowPriority.add(resourceRental);
    }
  }

  async release(resourceRental: ResourceRental): Promise<void> {
    if (this.getAvailableSize() >= this.maxPoolSize) {
      return this.destroy(resourceRental);
    }
    this.borrowed.delete(resourceRental);
    const isValid = await this.validate(resourceRental);
    if (!isValid) {
      return this.destroy(resourceRental);
    }
    this.events.emit("released", resourceRental.agreement);
    this.passResourceRentalToWaitingAcquireOrBackToPool(resourceRental);
  }

  async destroy(resourceRental: ResourceRental): Promise<void> {
    try {
      this.borrowed.delete(resourceRental);
      this.logger.debug("Destroying resource rental from the pool", { agreementId: resourceRental.agreement.id });
      await Promise.all([resourceRental.stopAndFinalize(), this.removeNetworkNode(resourceRental)]);
      this.events.emit("destroyed", resourceRental.agreement);
    } catch (error) {
      this.events.emit(
        "error",
        new GolemMarketError(
          "Destroying resource rental failed",
          MarketErrorCode.ResourceRentalTerminationFailed,
          error,
        ),
      );
      this.logger.error("Destroying resource rental failed", error);
    }
  }

  private get isDraining(): boolean {
    return !!this.drainPromise;
  }

  private async startDrain() {
    try {
      this.abortController.abort("The pool is in draining mode");
      this.events.emit("draining");
      this.acquireQueue = [];
      const allResourceRentals = Array.from(this.borrowed)
        .concat(Array.from(this.lowPriority))
        .concat(Array.from(this.highPriority));
      await Promise.allSettled(allResourceRentals.map((resourceRental) => this.destroy(resourceRental)));
      this.lowPriority.clear();
      this.highPriority.clear();
      this.borrowed.clear();
      this.abortController = new AbortController();
    } catch (error) {
      this.logger.error("Draining the pool failed", error);
      throw error;
    } finally {
      this.events.emit("end");
    }
  }

  /**
   * Sets the pool into draining mode and then clears it
   *
   * When set to drain mode, no new acquires will be possible. At the same time, all agreements in the pool will be terminated with the Providers.
   *
   * @return Resolves when all agreements are terminated
   */
  async drainAndClear() {
    if (this.isDraining) {
      return this.drainPromise;
    }
    this.drainPromise = this.startDrain().finally(() => {
      this.drainPromise = undefined;
    });
    return this.drainPromise;
  }
  /**
   * Total size (available + borrowed)
   */
  getSize() {
    return this.getAvailableSize() + this.getBorrowedSize();
  }

  /**
   * Available size (how many resource rental are ready to be borrowed)
   */
  getAvailableSize() {
    return this.lowPriority.size + this.highPriority.size;
  }

  /**
   * Borrowed size (how many resource rental are currently out of the pool)
   */
  getBorrowedSize() {
    return this.borrowed.size;
  }

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
  async ready(timeoutMs?: number): Promise<void>;
  async ready(abortSignal?: AbortSignal): Promise<void>;
  async ready(timeoutOrAbortSignal?: number | AbortSignal): Promise<void> {
    if (this.minPoolSize <= this.getAvailableSize()) {
      return;
    }
    const signal = anyAbortSignal(this.abortController.signal, createAbortSignalFromTimeout(timeoutOrAbortSignal));
    const tryCreatingMissingResourceRentals = async () => {
      await Promise.allSettled(
        new Array(this.minPoolSize - this.getAvailableSize()).fill(0).map(() =>
          this.createNewResourceRental(signal).then(
            (resourceRental) => this.lowPriority.add(resourceRental),
            (error) => this.logger.error("Creating resource rental failed", error),
          ),
        ),
      );
    };

    while (this.minPoolSize > this.getAvailableSize()) {
      if (signal.aborted) {
        break;
      }
      await runOnNextEventLoopIteration(tryCreatingMissingResourceRentals);
    }

    if (this.minPoolSize > this.getAvailableSize()) {
      throw new Error("Could not create enough resource rentals to reach the minimum pool size in time");
    }
    this.events.emit("ready");
  }

  private async removeNetworkNode(resourceRental: ResourceRental) {
    if (this.network && resourceRental.networkNode) {
      this.logger.debug("Removing a node from the network", {
        network: this.network.getNetworkInfo().ip,
        nodeIp: resourceRental.networkNode.ip,
      });
      await this.networkModule.removeNetworkNode(this.network, resourceRental.networkNode);
    }
  }

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
  public async withRental<T>(
    callback: (rental: ResourceRental) => Promise<T>,
    signalOrTimeout?: number | AbortSignal,
  ): Promise<T> {
    const rental = await this.acquire(signalOrTimeout);
    try {
      return await callback(rental);
    } finally {
      await this.release(rental);
    }
  }
}
