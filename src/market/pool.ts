import { Proposal } from "./proposal";
import { BuildDemandParams, MarketModule } from "./market.module";
import { YagnaEventSubscription } from "../shared/utils";
import { Demand } from "./demand";
import { ProposalFilter } from "./service";

interface ProposalPoolOptions {
  demand: BuildDemandParams;
  marketModule: MarketModule;
  filter?: ProposalFilter;
}

export class ProposalPool {
  private demand?: Demand;
  private subscription?: YagnaEventSubscription<Proposal>;
  private proposals = new Map<string, Proposal>();

  constructor(private options: ProposalPoolOptions) {}

  async start() {
    this.demand = await this.options.marketModule.buildDemand(this.options.demand);
    this.subscription = this.options.marketModule
      .subscribeForProposals(this.demand)
      .filter(this.options.filter ?? (() => true));
    this.subscription.on((proposal) => this.processProposal(proposal));
  }

  async stop() {
    throw new Error("TODO");
  }

  async acquire(): Promise<Proposal> {
    throw new Error("TODO");
  }

  async release(proposal: Proposal): Promise<void> {
    throw new Error(`TODO ${proposal}`);
  }

  async destroy(proposal: Proposal): Promise<void> {
    throw new Error(`TODO ${proposal}`);
  }

  private async processProposal(proposal: Proposal) {
    throw new Error(`TODO ${proposal}`);
    // const negotiatedProposal = await this.options.marketModule.negotiateProposal(proposal, proposal);
    // this.proposals.set(negotiatedProposal.id, negotiatedProposal);
  }
}
