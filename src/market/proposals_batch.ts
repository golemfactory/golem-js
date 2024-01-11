import { Proposal } from "./proposal";
import AsyncLock from "async-lock";

export class ProposalsBatch {
  private batch = new Map<string, Set<Proposal>>();
  private lock: AsyncLock = new AsyncLock();
  constructor(private config: { minBatchSize: number; timeout: number; expirationSec: number }) {}

  async addProposal(proposal: Proposal) {
    const providerKey = this.getProviderKey(proposal);
    const proposals = this.batch.get(providerKey) || new Set<Proposal>();
    await this.lock.acquire("app", () => {
      this.batch.set(providerKey, proposals);
      proposals.add(proposal);
    });
  }

  async getProposals(): Promise<Proposal[]> {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const intervalId = setInterval(async () => {
        const isTimeoutReached = Date.now() - startTime >= this.config.timeout;
        if (this.batch.size >= this.config.minBatchSize || isTimeoutReached) {
          const proposals: Proposal[] = [];
          await this.lock.acquire("app", () => {
            this.batch.forEach((providersProposals) => proposals.push(this.getBestProposal(providersProposals)));
            this.batch.clear();
          });
          resolve(proposals);
          clearInterval(intervalId);
        }
      }, 1_000);
    });
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
