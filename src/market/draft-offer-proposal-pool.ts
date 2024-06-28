import { OfferProposal, OfferProposalFilter } from "./proposal";
import AsyncLock from "async-lock";
import { EventEmitter } from "eventemitter3";
import { GolemMarketError, MarketErrorCode } from "./error";
import { createAbortSignalFromTimeout, defaultLogger, Logger, sleep } from "../shared/utils";
import { Observable, Subscription } from "rxjs";
import { GolemAbortError, GolemTimeoutError } from "../shared/error/golem-error";

export type OfferProposalSelector = (proposals: OfferProposal[]) => OfferProposal;

export interface ProposalPoolOptions {
  /**
   * A user-defined function that will be used by {@link DraftOfferProposalPool.acquire} to pick the best fitting offer proposal from available ones
   */
  selectOfferProposal?: OfferProposalSelector;

  /**
   * User defined filter function which will determine if the offer proposal is valid for use.
   *
   * Offer proposals are validated before being handled to the caller of {@link DraftOfferProposalPool.acquire}
   */
  validateOfferProposal?: OfferProposalFilter;

  /**
   * Min number of proposals in pool so that it can be considered as ready to use
   *
   * @default 0
   */
  minCount?: number;

  logger?: Logger;
}

export interface ProposalPoolEvents {
  added: (event: { proposal: OfferProposal }) => void;
  removed: (event: { proposal: OfferProposal }) => void;
  acquired: (event: { proposal: OfferProposal }) => void;
  released: (event: { proposal: OfferProposal }) => void;
  cleared: () => void;
}

/**
 * Pool of draft offer proposals that are ready to be promoted to agreements with Providers
 *
 * Reaching this pool means that the related initial proposal which was delivered by Yagna in response
 * to the subscription with the Demand has been fully negotiated between the Provider and Requestor.
 *
 * This pool should contain only offer proposals that can be used to pursue the final Agreement between the
 * parties.
 *
 * Technically, the "market" part of you application should populate this pool with such offer proposals.
 */
export class DraftOfferProposalPool {
  public readonly events = new EventEmitter<ProposalPoolEvents>();

  private logger: Logger;
  private readonly lock: AsyncLock = new AsyncLock();

  /** {@link ProposalPoolOptions.minCount} */
  private readonly minCount: number = 0;

  /** {@link ProposalPoolOptions.selectOfferProposal} */
  private readonly selectOfferProposal: OfferProposalSelector = (proposals: OfferProposal[]) => proposals[0];

  /** {@link ProposalPoolOptions.validateOfferProposal} */
  private readonly validateOfferProposal: OfferProposalFilter = (proposal: OfferProposal) => proposal !== undefined;

  /**
   * The proposals that were not yet leased to anyone and are available for lease
   */
  private available = new Set<OfferProposal>();

  /**
   * The proposal that were already leased to someone and shouldn't be leased again
   */
  private leased = new Set<OfferProposal>();

  public constructor(private options?: ProposalPoolOptions) {
    if (options?.selectOfferProposal) {
      this.selectOfferProposal = options.selectOfferProposal;
    }
    if (options?.validateOfferProposal) {
      this.validateOfferProposal = options.validateOfferProposal;
    }

    if (options?.minCount && options.minCount >= 0) {
      this.minCount = options.minCount;
    }

    this.logger = this.logger = options?.logger || defaultLogger("proposal-pool");
  }

  /**
   * Pushes the provided proposal to the list of proposals available for lease
   */
  public add(proposal: OfferProposal) {
    if (!proposal.isDraft()) {
      this.logger.error("Cannot add a non-draft proposal to the pool", { proposalId: proposal.id });
      throw new GolemMarketError("Cannot add a non-draft proposal to the pool", MarketErrorCode.InvalidProposal);
    }

    this.available.add(proposal);

    this.events.emit("added", { proposal });
  }

  /**
   * Attempts to obtain a single proposal from the pool
   * @param signalOrTimeout - the timeout in milliseconds or an AbortSignal that will be used to cancel the acquiring
   */
  public acquire(signalOrTimeout?: number | AbortSignal): Promise<OfferProposal> {
    const signal = createAbortSignalFromTimeout(signalOrTimeout);
    return this.lock.acquire("proposal-pool", async () => {
      let proposal: OfferProposal | null = null;

      while (proposal === null) {
        if (signal.aborted) {
          throw signal.reason.name === "TimeoutError"
            ? new GolemTimeoutError("Could not provide any proposal in time")
            : new GolemAbortError("The acquiring of proposals has been aborted", signal.reason);
        }
        // Try to get one
        proposal = this.available.size > 0 ? this.selectOfferProposal([...this.available]) : null;

        if (proposal) {
          // Validate
          if (!this.validateOfferProposal(proposal)) {
            // Drop if not valid
            this.removeFromAvailable(proposal);
            // Keep searching
            proposal = null;
          }
        }
        // if not found or not valid wait a while for next try
        if (!proposal) {
          await sleep(1);
        }
      }

      this.available.delete(proposal);
      this.leased.add(proposal);

      this.events.emit("acquired", { proposal });

      return proposal;
    });
  }

  /**
   * Releases the proposal back to the pool
   *
   * Validates if the proposal is still usable before putting it back to the list of available ones
   * @param proposal
   */
  public release(proposal: OfferProposal): Promise<void> {
    return this.lock.acquire("proposal-pool", () => {
      this.leased.delete(proposal);

      if (this.validateOfferProposal(proposal)) {
        this.available.add(proposal);
        this.events.emit("released", { proposal });
      } else {
        this.events.emit("removed", { proposal });
      }
    });
  }

  public remove(proposal: OfferProposal): Promise<void> {
    return this.lock.acquire("proposal-pool", () => {
      if (this.leased.has(proposal)) {
        this.leased.delete(proposal);
        this.events.emit("removed", { proposal });
      }

      if (this.available.has(proposal)) {
        this.available.delete(proposal);
        this.events.emit("removed", { proposal });
      }
    });
  }

  /**
   * Returns the number of all items in the pool (available + leased out)
   */
  public count() {
    return this.availableCount() + this.leasedCount();
  }

  /**
   * Returns the number of items that are possible to lease from the pool
   */
  public availableCount() {
    return this.available.size;
  }

  /**
   * Returns the number of items that were leased out of the pool
   */
  public leasedCount() {
    return this.leased.size;
  }

  /**
   * Tells if the pool is ready to take items from
   */
  public isReady() {
    return this.count() >= this.minCount;
  }

  /**
   * Clears the pool entirely
   */
  public async clear() {
    return this.lock.acquire("proposal-pool", () => {
      for (const proposal of this.available) {
        this.available.delete(proposal);
        this.events.emit("removed", { proposal });
      }

      for (const proposal of this.leased) {
        this.leased.delete(proposal);
        this.events.emit("removed", { proposal });
      }

      this.available = new Set();
      this.leased = new Set();
      this.events.emit("cleared");
    });
  }

  protected removeFromAvailable(proposal: OfferProposal): void {
    this.available.delete(proposal);
    this.events.emit("removed", { proposal });
  }

  public readFrom(source: Observable<OfferProposal>): Subscription {
    return source.subscribe({
      next: (proposal) => this.add(proposal),
      error: (err) => this.logger.error("Error while collecting proposals", err),
    });
  }
}
