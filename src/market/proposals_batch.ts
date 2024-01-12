import { Proposal } from "./proposal";
import AsyncLock from "async-lock";

export type ProposalsBatchOptions = {
  /** The minimum number of proposals after which it will be possible to return the collection */
  minBatchSize?: number;
  /** The maximum waiting time for collecting proposals after which it will be possible to return the collection */
  timeout?: number;
  /** Demand expiration time used to estimate the maximum proposal price */
  expirationSec?: number;
};

const DEFAULTS = {
  minBatchSize: 100,
  timeout: 1_000,
  expirationSec: 1,
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
      timeout: options?.timeout ?? DEFAULTS.timeout,
      expirationSec: options?.expirationSec ?? DEFAULTS.expirationSec,
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
   * Returns a set of proposals that were collected within the specified `timeout` or their number reached the `minBatchSize` value
   */
  async getProposals(): Promise<Proposal[]> {
    const startTime = Date.now();
    const drainBatch = async (resolve: (proposals: Proposal[]) => void) => {
      const isTimeoutReached = Date.now() - startTime >= this.config.timeout;
      if (this.batch.size >= this.config.minBatchSize || isTimeoutReached) {
        const proposals: Proposal[] = [];
        await this.lock.acquire("proposals-batch", () => {
          this.batch.forEach((providersProposals) => proposals.push(this.getBestProposal(providersProposals)));
          this.batch.clear();
        });
        resolve(proposals);
      } else {
        setTimeout(() => drainBatch(resolve), this.config.timeout < 1_000 ? this.config.timeout : 1_000);
      }
    };
    return new Promise(drainBatch);
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
   * Estimation of the maximum price of the proposal based on the costs of CPU, Env and start
   */
  private estimatePrice(proposal: Proposal): number {
    const maxDurationSec = this.config.expirationSec;
    const threadsNo = proposal.properties["golem.inf.cpu.threads"];
    return (
      proposal.pricing.start +
      proposal.pricing.cpuSec * threadsNo * maxDurationSec +
      proposal.pricing.envSec * maxDurationSec
    );
  }
}
