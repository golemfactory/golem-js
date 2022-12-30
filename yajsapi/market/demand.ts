import { Package } from "../package";
import { Allocation } from "../payment";
import { YagnaOptions } from "../executor";
import { DemandFactory } from "./factory";
import { DecorationsBuilder } from "./builder";
import { MarketProperty } from "ya-ts-client/dist/ya-payment/src/models/";
import { Proposal } from "./proposal";
import { Logger, sleep } from "../utils";
import { DemandConfig } from "./config";
import { Events } from "../events";
import { ProposalEvent } from "ya-ts-client/dist/ya-market/src/models";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market";

export interface DemandOptions {
  subnetTag?: string;
  yagnaOptions?: YagnaOptions;
  timeout?: number;
  logger?: Logger;
  maxOfferEvents?: number;
  offerFetchingInterval?: number;
  eventTarget?: EventTarget;
}

export const DemandEventType = "ProposalReceived";

export class Demand extends EventTarget {
  private isRunning = true;
  private logger?: Logger;

  static async create(taskPackage: Package, allocations: Allocation[], options?: DemandOptions): Promise<Demand> {
    const factory = new DemandFactory(taskPackage, allocations, options);
    return factory.create();
  }

  constructor(public readonly id, private demandRequest: DemandOfferBase, private options: DemandConfig) {
    super();
    this.logger = this.options.logger;
    this.subscribe().catch((e) => this.logger?.error(e));
  }

  async unsubscribe() {
    this.isRunning = false;
    await this.options.api.unsubscribeDemand(this.id);
    this.removeEventListener(DemandEventType, null);
    this.logger?.debug(`Demand ${this.id} unsubscribed`);
  }

  private async subscribe() {
    while (this.isRunning) {
      try {
        const { data: events } = await this.options.api.collectOffers(this.id, 3, this.options.maxOfferEvents, {
          timeout: 5000,
        });
        for (const event of events as ProposalEvent[]) {
          if (event.eventType !== "ProposalEvent") continue;
          const proposal = new Proposal(
            this.id,
            this.options.api,
            event.proposal,
            this.demandRequest,
            this.options.eventTarget
          );
          this.dispatchEvent(new DemandEvent(DemandEventType, proposal));
          this.options.eventTarget?.dispatchEvent(
            new Events.ProposalReceived({ id: proposal.id, providerId: proposal.issuerId })
          );
        }
      } catch (error) {
        if (this.isRunning) {
          const reason = error.response?.data?.message || error;
          this.options.eventTarget?.dispatchEvent(new Events.CollectFailed({ id: this.id, reason }));
          this.logger?.warn(`Unable to collect offers. ${reason}`);
        }
      } finally {
        await sleep(this.options.offerFetchingInterval, true);
      }
    }
  }
}

export class DemandEvent extends Event {
  readonly proposal: Proposal;
  constructor(type, data) {
    super(type, data);
    this.proposal = data;
  }
}
