import { Proposal } from "./proposal";
import AsyncLock from "async-lock";

export type ProposalsBatchOptions = {
  minBatchSize?: number;
  timeout?: number;
  expirationSec?: number;
};

export class ProposalsBatch {
  private batch = new Map<string, Set<Proposal>>();
  private lock: AsyncLock = new AsyncLock();
  private config: Required<ProposalsBatchOptions>;
  constructor(options?: ProposalsBatchOptions) {
    this.config = {
      minBatchSize: options?.minBatchSize ?? 100,
      timeout: options?.timeout ?? 1_000,
      expirationSec: options?.expirationSec ?? 1,
    };
  }

  async addProposal(proposal: Proposal) {
    const providerKey = this.getProviderKey(proposal);
    const proposals = this.batch.get(providerKey) || new Set<Proposal>();
    await this.lock.acquire("proposals-batch", () => {
      this.batch.set(providerKey, proposals);
      proposals.add(proposal);
    });
  }

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

  private getProviderKey(proposal: Proposal): string {
    return [
      proposal.provider.id,
      proposal.properties["golem.inf.cpu.cores"],
      proposal.properties["golem.inf.cpu.threads"],
      proposal.properties["golem.inf.mem.gib"],
      proposal.properties["golem.inf.storage.gib"],
    ].join("-");
  }

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
