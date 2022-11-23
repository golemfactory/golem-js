import { DemandOfferBase } from "ya-ts-client/dist/ya-market";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { Package } from "../../package";
import { Allocation } from "../../payment/allocation";
import { YagnaOptions } from "../../executor";
import { DemandFactory, createDemandRequest } from "./factory";
import { MarketProperty } from "ya-ts-client/dist/ya-payment/src/models/";
import { ProposalAllOfStateEnum, ProposalEvent } from "ya-ts-client/dist/ya-market/src/models";
import { Offer } from "./offer";
import { Proposal } from "./proposal";
import { sleep } from "../../utils";
import EventEmitter from "events";

export interface DemandOptions {
  subnetTag: string;
  yagnaOptions?: YagnaOptions;
  timeout?: number;
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
    private allowedPaymentPlatforms: Array<string>
  ) {
    super();
    this.subscribe().catch();
  }

  async unsubscribe() {
    this.isRunning = false;
    await this.api.unsubscribeDemand(this.id);
  }

  private async subscribe() {
    while (this.isRunning) {
      try {
        const { data: events } = await this.api.collectOffers(this.id, 3, 10);
        for (const event of events as ProposalEvent[]) {
          if (event.eventType !== "ProposalEvent") continue;
          if (event.proposal.state === ProposalAllOfStateEnum.Initial) {
            const commonPaymentPlatforms = this.getCommonPaymentPlatforms();
            this.properties["golem.com.payment.chosen-platform"] = commonPaymentPlatforms?.[0];
            const proposal = new Proposal(this.id, this.api, event.proposal, this.getDemandRequest());
            if (!commonPaymentPlatforms?.length) await proposal.reject("No common payments platform");
            else this.emit("proposal", proposal);
          } else if (event.proposal.state === ProposalAllOfStateEnum.Draft) {
            this.emit("offer", new Offer(this.id, event.proposal));
          }
        }
        await sleep(2);
      } catch (error) {
        // TODO: error handling
      }
    }
  }

  private getCommonPaymentPlatforms(): string[] | undefined {
    const providerPlatforms = Object.keys(this.properties)
      .filter((prop) => prop.startsWith("golem.com.payment.platform."))
      .map((prop) => prop.split(".")[4]) || ["NGNT"];
    return this.allowedPaymentPlatforms.filter((p) => providerPlatforms.includes(p));
  }

  private getDemandRequest(): DemandOfferBase {
    return createDemandRequest(this.properties, this.constraints);
  }
}
