import { Proposal } from "./proposal";
import AsyncLock from "async-lock";

export type ProposalsBatchOptions = {
  /** The minimum number of proposals after which it will be possible to return the collection */
  minBatchSize?: number;
  /** The maximum waiting time for collecting proposals after which it will be possible to return the collection */
  releaseTimeoutMs?: number;
};

const DEFAULTS = {
  minBatchSize: 100,
  releaseTimeoutMs: 1_000,
};

/**
 * Proposals Batch aggregates initial proposals and returns a set grouped by the provider's key
 * to avoid duplicate offers issued by the provider.
 */
export class ProposalsBatch {
  /** Batch of proposals mapped by provider key and related set of initial proposals */
  private batch = new Map<string, Set<Proposal>>();
  /** Lock used to synchronize adding and getting proposals from the batch */
  private lock: AsyncLock = new AsyncLock();
  private config: Required<ProposalsBatchOptions>;

  constructor(options?: ProposalsBatchOptions) {
    this.config = {
      minBatchSize: options?.minBatchSize ?? DEFAULTS.minBatchSize,
      releaseTimeoutMs: options?.releaseTimeoutMs ?? DEFAULTS.releaseTimeoutMs,
    };
  }

  /**
   * Add proposal to the batch grouped by provider key
   * which consist of providerId, cores, threads, mem and storage
   */
  async addProposal(proposal: Proposal) {
    const providerKey = this.getProviderKey(proposal);
    await this.lock.acquire("proposals-batch", () => {
      let proposals = this.batch.get(providerKey);
      if (!proposals) {
        proposals = new Set<Proposal>();
        this.batch.set(providerKey, proposals);
      }
      proposals.add(proposal);
    });
  }

  /**
   * Returns a set of proposals that were collected within the specified `timeoutMs`
   * or their size reached the `minBatchSize` value
   */
  async *readProposals(): AsyncGenerator<Proposal[]> {
    let timeoutId, intervalId;
    const isTimeoutReached = new Promise((resolve) => {
      timeoutId = setTimeout(resolve, this.config.releaseTimeoutMs);
    });
    const isBatchSizeReached = new Promise((resolve) => {
      intervalId = setInterval(() => {
        if (this.batch.size >= this.config.minBatchSize) {
          resolve(true);
        }
      }, 1_000);
    });
    await Promise.race([isTimeoutReached, isBatchSizeReached]);
    clearTimeout(timeoutId);
    clearInterval(intervalId);
    const proposals: Proposal[] = [];
    await this.lock.acquire("proposals-batch", () => {
      this.batch.forEach((providersProposals) => proposals.push(this.getBestProposal(providersProposals)));
      this.batch.clear();
    });
    yield proposals;
  }

  /**
   * Selects the best proposal from the set according to the lowest price and the youngest proposal age
   */
  private getBestProposal(proposals: Set<Proposal>): Proposal {
    const sortByLowerPriceAndHigherTime = (p1: Proposal, p2: Proposal) => {
      const p1Price = this.estimatePrice(p1);
      const p2Price = this.estimatePrice(p2);
      const p1Time = new Date(p1.timestamp).valueOf();
      const p2Time = new Date(p2.timestamp).valueOf();
      return p1Price !== p2Price ? p1Price - p2Price : p2Time - p1Time;
    };
    return [...proposals].sort(sortByLowerPriceAndHigherTime)[0];
  }

  /**
   * Provider key used to group proposals so that they can be distinguished based on ID and hardware configuration
   */
  private getProviderKey(proposal: Proposal): string {
    return [
      proposal.provider.id,
      proposal.properties["golem.inf.cpu.cores"],
      proposal.properties["golem.inf.cpu.threads"],
      proposal.properties["golem.inf.mem.gib"],
      proposal.properties["golem.inf.storage.gib"],
    ].join("-");
  }

  /**
   * Proposal price estimation based on CPU, Env and startup costs
   */
  private estimatePrice(proposal: Proposal): number {
    const threadsNo = proposal.properties["golem.inf.cpu.threads"];
    return proposal.pricing.start + proposal.pricing.cpuSec * threadsNo + proposal.pricing.envSec;
  }
}
