import { Package } from "../package";
import { Allocation } from "../payment";
import { YagnaOptions } from "../executor";
import { DemandFactory } from "./factory";
import { Proposal } from "./proposal";
import { Logger, sleep } from "../utils";
import { DemandConfig } from "./config";
import { Events } from "../events";
import { ProposalEvent, ProposalRejectedEvent } from "ya-ts-client/dist/ya-market/src/models";
import { DemandOfferBase } from "ya-ts-client/dist/ya-market";
import * as events from "../events/events";

export interface DemandDetails {
  properties: Array<{ key: string; value: string | number | boolean }>;
  constraints: Array<string>;
}
/**
 * @hidden
 */
export interface DemandOptions {
  subnetTag?: string;
  yagnaOptions?: YagnaOptions;
  marketTimeout?: number;
  marketOfferExpiration?: number;
  logger?: Logger;
  maxOfferEvents?: number;
  offerFetchingInterval?: number;
  proposalTimeout?: number;
  eventTarget?: EventTarget;
}

/**
 * Event type with which all offers and proposals coming from the market will be emitted.
 * @hidden
 */
export const DemandEventType = "ProposalReceived";

/**
 * Demand module - an object which can be considered an "open" or public Demand, as it is not directed at a specific Provider, but rather is sent to the market so that the matching mechanism implementation can associate relevant Offers.
 * It is a special entity type because it inherits from the `EventTarget` class. Therefore, after creating it, you can add listeners to it, which will listen to offers from the market on an event of a specific type: `DemandEventType`.
 * @hidden
 */
export class Demand extends EventTarget {
  private isRunning = true;
  private logger?: Logger;
  private proposalReferences: ProposalReference[] = [];

  /**
   * Create demand for given taskPackage
   * Note: it is an "atomic" operation, ie. as soon as Demand is created, the subscription is published on the market.
   * @param taskPackage - {@link Package}
   * @param allocations - {@link Allocation}
   * @param options - {@link DemandOptions}
   * @return Demand
   */
  static async create(taskPackage: Package, allocation: Allocation, options?: DemandOptions): Promise<Demand> {
    const factory = new DemandFactory(taskPackage, allocation, options);
    return factory.create();
  }

  /**
   * @param id - demand ID
   * @param demandRequest - {@link DemandOfferBase}
   * @param options - {@link DemandConfig}
   * @hidden
   */
  constructor(
    public readonly id: string,
    private demandRequest: DemandOfferBase,
    private options: DemandConfig,
  ) {
    super();
    this.logger = this.options.logger;
    this.subscribe().catch((e) => this.logger?.error(e));
  }

  /**
   * Unsubscribe demand from the market
   */
  async unsubscribe() {
    this.isRunning = false;
    await this.options.api.unsubscribeDemand(this.id);
    this.options.eventTarget?.dispatchEvent(new events.DemandUnsubscribed({ id: this.id }));
    this.options.httpAgent.destroy?.();
    this.logger?.debug(`Demand ${this.id} unsubscribed`);
  }

  private findParentProposal(prevProposalId?: string): string | null {
    if (!prevProposalId) return null;
    for (const proposal of this.proposalReferences) {
      if (proposal.counteringProposalId === prevProposalId) {
        return proposal.id;
      }
    }
    return null;
  }

  private setCounteringProposalReference(id: string, counteringProposalId: string): void {
    this.proposalReferences.push(new ProposalReference(id, counteringProposalId));
  }

  private async subscribe() {
    while (this.isRunning) {
      try {
        const { data: events } = await this.options.api.collectOffers(
          this.id,
          this.options.offerFetchingInterval / 1000,
          this.options.maxOfferEvents,
          {
            timeout: 0,
          },
        );
        for (const event of events as Array<ProposalEvent & ProposalRejectedEvent>) {
          if (event.eventType === "ProposalRejectedEvent") {
            this.logger?.debug(`Proposal rejected. Reason: ${event.reason?.message}`);
            this.options.eventTarget?.dispatchEvent(
              new Events.ProposalRejected({
                id: event.proposalId,
                parentId: this.findParentProposal(event.proposalId),
                reason: event.reason?.message,
              }),
            );
            continue;
          } else if (event.eventType !== "ProposalEvent") continue;
          const proposal = new Proposal(
            this.id,
            event.proposal.state === "Draft" ? this.findParentProposal(event.proposal.prevProposalId) : null,
            this.setCounteringProposalReference.bind(this),
            this.options.api,
            event.proposal,
            this.demandRequest,
            this.options.eventTarget,
          );
          this.dispatchEvent(new DemandEvent(DemandEventType, proposal));
          this.options.eventTarget?.dispatchEvent(
            new Events.ProposalReceived({
              id: proposal.id,
              parentId: this.findParentProposal(event.proposal.prevProposalId),
              providerId: proposal.issuerId,
              details: proposal.details,
            }),
          );
        }
      } catch (error) {
        if (this.isRunning) {
          const reason = error.response?.data?.message || error;
          this.options.eventTarget?.dispatchEvent(new Events.CollectFailed({ id: this.id, reason }));
          this.logger?.warn(`Unable to collect offers. ${reason}`);
          if (error.code === "ECONNREFUSED" || error.response?.status === 404) {
            this.dispatchEvent(
              new DemandEvent(
                DemandEventType,
                undefined,
                new Error(`${error.code === "ECONNREFUSED" ? "Yagna connection error." : "Demand expired."} ${reason}`),
              ),
            );
            break;
          }
          await sleep(2);
        }
      }
    }
  }
}

/**
 * @hidden
 */
export class DemandEvent extends Event {
  readonly proposal: Proposal;
  readonly error?: Error;

  /**
   * Create a new instance of DemandEvent
   * @param type A string with the name of the event:
   * @param data object with proposal data:
   * @param error optional error if occurred while subscription is active
   */
  constructor(type, data?, error?) {
    super(type, data);
    this.proposal = data;
    this.error = error;
  }
}

class ProposalReference {
  constructor(
    readonly id: string,
    readonly counteringProposalId: string,
  ) {}
}
