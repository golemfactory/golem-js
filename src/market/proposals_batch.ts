import { Proposal } from "./proposal";

export class ProposalsBatch {
  private batch = new Map<string, Set<Proposal>>();
  addProposal(proposal: Proposal) {
    const proposals = this.batch.get(proposal.issuerId) || new Set<Proposal>();
    this.batch.set(proposal.issuerId, proposals);
    proposals.add(proposal);
  }

  getProposals(): Proposal[] {
    const proposals: Proposal[] = [];
    this.batch.forEach((providersProposals) => proposals.push(this.getBestProposalForProvider(providersProposals)));
    return proposals;
  }

  private getBestProposalForProvider(providersProposals: Set<Proposal>): Proposal {
    const sortByPrice = (p1: Proposal, p2: Proposal): number => {
      if (p1.pricing.cpuSec >= p2.pricing.cpuSec) return 1;
      return -1;
    };
    return [...providersProposals].sort(sortByPrice)[0];
  }
}
