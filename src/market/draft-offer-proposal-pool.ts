import { Proposal } from "./proposal";
import AsyncLock from "async-lock";
import { EventEmitter } from "eventemitter3";
import { GolemMarketError, MarketErrorCode } from "./error";
import { sleep } from "../shared/utils";

export type ProposalSelector = (proposals: Proposal[]) => Proposal;
export type ProposalValidator = (proposal: Proposal) => boolean;

export interface ProposalPoolOptions {
  /**
   * A user-defined function that will be used by {@link DraftOfferProposalPool.acquire} to pick the best fitting proposal from available ones
   */
  selectProposal?: ProposalSelector;

  /**
   * User defined filter function which will determine if the proposal is valid for use.
   *
   * Proposals are validated before being handled to the caller of {@link DraftOfferProposalPool.acquire}
   */
  validateProposal?: ProposalValidator;

  /**
   * Min number of proposals in pool so that it can be considered as ready to use
   *
   * @default 0
   */
  minCount?: number;

  /**
   * Number of seconds to wait for an acquire call to finish before throwing an exception
   *
   * @default 30
   */
  acquireTimeoutSec?: number;
}

export interface ProposalPoolEvents {
  added: (proposal: Proposal) => void;
  removed: (proposal: Proposal) => void;
  acquired: (proposal: Proposal) => void;
  released: (proposal: Proposal) => void;
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

  private readonly lock: AsyncLock = new AsyncLock();

  /** {@link ProposalPoolOptions.minCount} */
  private readonly minCount: number = 0;

  /** {@link ProposalPoolOptions.acquireTimeoutSec} */
  private readonly acquireTimeoutSec: number = 30;

  /** {@link ProposalPoolOptions.selectProposal} */
  private readonly selectProposal: ProposalSelector = (proposals: Proposal[]) => proposals[0];

  /** {@link ProposalPoolOptions.validateProposal} */
  private readonly validateProposal: ProposalValidator = (proposal: Proposal) => proposal !== undefined;

  /**
   * The proposals that were not yet leased to anyone and are available for lease
   */
  private available = new Set<Proposal>();

  /**
   * The proposal that were already leased to someone and shouldn't be leased again
   */
  private leased = new Set<Proposal>();

  constructor(private options?: ProposalPoolOptions) {
    if (options?.selectProposal) {
      this.selectProposal = options.selectProposal;
    }
    if (options?.validateProposal) {
      this.validateProposal = options.validateProposal;
    }

    if (options?.minCount && options.minCount >= 0) {
      this.minCount = options.minCount;
    }

    if (options?.acquireTimeoutSec && options.acquireTimeoutSec >= 0) {
      this.acquireTimeoutSec = options?.acquireTimeoutSec;
    }
  }

  /**
   * Pushes the provided proposal to the list of proposals available for lease
   */
  add(proposal: Proposal) {
    if (!proposal.isDraft()) {
      throw new GolemMarketError("Cannot add a non-draft proposal to the pool", MarketErrorCode.InvalidProposal);
    }
    this.available.add(proposal);
    this.events.emit("added", proposal);
  }

  /**
   * Attempts to obtain a single proposal from the pool
   *
   * This method will reject if no suitable proposal will be found within {@link DraftOfferProposalPool.acquireTimeoutSec} seconds.
   */
  async acquire(): Promise<Proposal> {
    return this.lock.acquire(
      "proposal-pool",
      async () => {
        // if (this.available.size === 0) {
        //   throw new GolemMarketError("The proposal pool is empty, cannot acquire", MarketErrorCode.NoProposalAvailable);
        // }

        let proposal: Proposal | null = null;

        do {
          // Try to get one
          proposal = this.selectProposal([...this.available]);

          // Validate
          if (!this.validateProposal(proposal)) {
            // Drop if not valid
            this.removeFromAvailable(proposal);
            // Keep searching
            proposal = null;
            await sleep(1);
          }
        } while (proposal === null);

        this.available.delete(proposal);
        this.leased.add(proposal);

        this.events.emit("acquired", proposal);

        return proposal;
      },
      {
        maxOccupationTime: this.acquireTimeoutSec * 1000,
      },
    );
  }

  /**
   * Releases the proposal back to the pool
   *
   * Validates if the proposal is still usable before putting it back to the list of available ones
   * @param proposal
   */
  async release(proposal: Proposal): Promise<void> {
    await this.lock.acquire("proposal-pool", () => {
      this.leased.delete(proposal);

      if (this.validateProposal(proposal)) {
        this.available.add(proposal);
        this.events.emit("released", proposal);
      } else {
        this.events.emit("removed", proposal);
      }
    });
  }

  async remove(proposal: Proposal): Promise<void> {
    await this.lock.acquire("proposal-pool", () => {
      if (this.leased.has(proposal)) {
        this.leased.delete(proposal);
        this.events.emit("removed", proposal);
      }

      if (this.available.has(proposal)) {
        this.available.delete(proposal);
        this.events.emit("removed", proposal);
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
        this.events.emit("removed", proposal);
      }

      for (const proposal of this.leased) {
        this.leased.delete(proposal);
        this.events.emit("removed", proposal);
      }

      this.available = new Set();
      this.leased = new Set();
      this.events.emit("cleared");
    });
  }

  protected removeFromAvailable(proposal: Proposal): void {
    this.available.delete(proposal);
    this.events.emit("removed", proposal);
  }
}
