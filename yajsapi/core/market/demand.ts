import { DemandOfferBase, ProposalEvent } from "ya-ts-client/dist/ya-market";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Package } from "../../package";
import { Allocation } from "../../payment/allocation";
import { YagnaOptions } from "../../executor";
import { DemandFactory, createDemandRequest } from "./factory";
import { MarketProperty } from "ya-ts-client/dist/ya-payment/src/models/";
import { Proposal } from "./proposal";
import { Logger, sleep } from "../../utils";
import EventEmitter from "events";

export interface DemandOptions {
  subnetTag?: string;
  yagnaOptions?: YagnaOptions;
  timeout?: number;
  logger?: Logger;
}

export enum DemandEvent {
  ProposalReceived = "ProposalReceived",
}

export class Demand extends EventEmitter {
  private isRunning = true;

  static async create(taskPackage: Package, allocations: Allocation[], demandOptions: DemandOptions): Promise<Demand> {
    const factory = new DemandFactory(taskPackage, allocations, demandOptions);
    return factory.create();
  }

  constructor(
    public readonly id,
    private api: RequestorApi,
    private properties: Array<MarketProperty>,
    private constraints: Array<string>,
    private logger?: Logger
  ) {
    super();
    this.subscribe().catch((e) => this.logger?.error(`Could not collect offers. ${e}`));
    this.logger?.info(`Demand ${id} created and published on the market`);
  }

  async unsubscribe() {
    this.isRunning = false;
    await this.api.unsubscribeDemand(this.id);
    this.logger?.debug(`Demand ${this.id} unsubscribed`);
  }

  private async subscribe() {
    while (this.isRunning) {
      try {
        const { data: events } = await this.api.collectOffers(this.id, 3, 10);
        for (const event of events as ProposalEvent[]) {
          if (event.eventType !== "ProposalEvent") continue;
          const proposal = new Proposal(this.id, this.api, event.proposal, this.getDemandRequest());
          this.emit(DemandEvent.ProposalReceived, proposal);
        }
        await sleep(2);
      } catch (error) {
        this.logger?.warn(`Could not collect offers. ${error.response?.data?.message || error}`);
      }
    }
  }

  private getDemandRequest(): DemandOfferBase {
    return createDemandRequest(this.properties, this.constraints);
  }
}
