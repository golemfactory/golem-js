import { ProposalNew, ProposalDTO } from "./proposal";
import { defaultLogger } from "../shared/utils";
import type { Logger } from "../shared/utils";
import AsyncLock from "async-lock";
import { EventEmitter } from "eventemitter3";

export type ProposalSelector = (proposals: ProposalNew[]) => ProposalNew;

export interface ProposalPoolOptions {
  selector?: ProposalSelector;
  logger?: Logger;
}

export interface ProposalPoolEvents {
  added: (proposal: ProposalDTO) => void;
  acquired: (proposal: ProposalDTO) => void;
  released: (proposal: ProposalDTO) => void;
  destroyed: (proposal: ProposalDTO) => void;
}

const DEFAULTS = {
  selector: (proposals: ProposalNew[]) => proposals[0],
};

export class ProposalPool {
  public readonly events = new EventEmitter<ProposalPoolEvents>();

  private readonly selector: ProposalSelector;
  private readonly lock: AsyncLock = new AsyncLock();
  private readonly logger: Logger;
  private proposals = new Set<ProposalNew>();

  constructor(private options?: ProposalPoolOptions) {
    this.selector = options?.selector || DEFAULTS.selector;
    this.logger = this.logger = options?.logger || defaultLogger("proposal-pool");
  }

  async add(proposal: ProposalNew) {
    return this.lock.acquire("proposal-pool", () => {
      this.proposals.add(proposal);
      this.events.emit("added", proposal.getDto());
    });
  }

  async acquire(): Promise<ProposalNew> {
    return this.lock.acquire("proposal-pool", () => {
      if (this.proposals.size === 0) {
        // TODO: ??
      }
      const proposal = this.selector([...this.proposals]);
      if (!this.validateProposal(proposal)) {
        // TODO: ??
      }
      this.proposals.delete(proposal);
      this.events.emit("acquired", proposal.getDto());
      return proposal;
    });
  }

  async release(proposal: ProposalNew): Promise<void> {
    await this.lock.acquire("proposal-pool", () => {
      if (this.validateProposal(proposal)) {
        this.proposals.add(proposal);
      } else {
        // TODO: is it possible inside lock ??
        this.destroy(proposal);
      }
      this.events.emit("released", proposal.getDto());
    });
  }

  async destroy(proposal: ProposalNew): Promise<void> {
    await this.lock.acquire("proposal-pool", () => {
      this.proposals.delete(proposal);
      this.events.emit("destroyed", proposal.getDto());
    });
  }

  private validateProposal(proposal: ProposalNew): boolean {
    // TODO:
    return proposal.isInitial();
  }
}
