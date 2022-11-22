import EventEmitter from "events";
import { RequestorApi } from "ya-ts-client/dist/ya-market/api";
import { ProposalEvent, ProposalAllOfStateEnum } from "ya-ts-client/dist/ya-market/src/models";
import { Offer, Proposal } from "./offer";
import { sleep } from "../utils";
import { Demand } from "./demand";

export class Subscription extends EventEmitter {
  private isRunning = true;
  constructor(
    public readonly subscriptionId: string,
    private demand: Demand,
    private allowedPlatforms: string[],
    private api: RequestorApi
  ) {
    super();
  }

  async subscribe() {
    // TODO: polling replace to long polling or websocket?
    while (this.isRunning) {
      try {
        const { data: events } = await this.api.collectOffers(this.subscriptionId, 3, 10);
        for (const event of events as ProposalEvent[]) {
          if (event.eventType !== "ProposalEvent") continue;
          if (event.proposal.state === ProposalAllOfStateEnum.Initial) {
            this.emit(
              "proposal",
              new Proposal(this.subscriptionId, event.proposal, this.demand, this.api, this.allowedPlatforms)
            );
          } else if (event.proposal.state === ProposalAllOfStateEnum.Draft) {
            this.emit("offer", new Offer(this.subscriptionId, event.proposal, this.demand));
          }
        }
        await sleep(2);
      } catch (error) {
        // TODO: error handling
      }
    }
  }

  async unsubscribe() {
    this.isRunning = false;
    await this.api.unsubscribeDemand(this.subscriptionId);
  }
}
