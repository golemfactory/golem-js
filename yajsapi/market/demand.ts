import { DemandOfferBase, ProposalEvent } from "ya-ts-client/dist/ya-market";
import { Package } from "../package";
import { Allocation } from "../payment/allocation";
import { YagnaOptions } from "../executor";
import { DemandFactory, createDemandRequest } from "./factory";
import { MarketProperty } from "ya-ts-client/dist/ya-payment/src/models/";
import { Proposal } from "./proposal";
import { Logger, sleep } from "../utils";
import EventEmitter from "events";
import { DemandConfig } from "./config";
import * as events from "../events/events";

export interface DemandOptions {
  subnetTag?: string;
  yagnaOptions?: YagnaOptions;
  timeout?: number;
  logger?: Logger;
  maxOfferEvents?: number;
  offerFetchingInterval?: number;
  eventTarget?: EventTarget;
}

export enum DemandEvent {
  ProposalReceived = "ProposalReceived",
}

export class Demand extends EventEmitter {
  private isRunning = true;
  private logger?: Logger;

  static async create(taskPackage: Package, allocations: Allocation[], options?: DemandOptions): Promise<Demand> {
    const factory = new DemandFactory(taskPackage, allocations, options);
    return factory.create();
  }

  constructor(
    public readonly id,
    private properties: Array<MarketProperty>,
    private constraints: Array<string>,
    private options: DemandConfig
  ) {
    super();
    this.logger = this.options.logger;
    this.subscribe().catch((e) => this.logger?.error(`Could not collect offers. ${e}`));
    this.options.eventTarget?.dispatchEvent(new events.SubscriptionCreated({ id: this.id }));
    this.logger?.info(`Demand published on the market`);
  }

  async unsubscribe() {
    this.isRunning = false;
    await this.options.api.unsubscribeDemand(this.id);
    this.logger?.debug(`Demand ${this.id} unsubscribed`);
  }

  private async subscribe() {
    while (this.isRunning) {
      try {
        const { data: events } = await this.options.api.collectOffers(
          this.id,
          this.options.timeout / 1000,
          this.options.maxOfferEvents
        );
        for (const event of events as ProposalEvent[]) {
          if (event.eventType !== "ProposalEvent") continue;
          const proposal = new Proposal(this.id, this.options.api, event.proposal, this.getDemandRequest());
          this.emit(DemandEvent.ProposalReceived, proposal);
        }
        await sleep(this.options.offerFetchingInterval, true);
      } catch (error) {
        if (this.isRunning) this.logger?.warn(`Could not collect offers. ${error.response?.data?.message || error}`);
      }
    }
  }

  private getDemandRequest(): DemandOfferBase {
    return createDemandRequest(this.properties, this.constraints);
  }
}
