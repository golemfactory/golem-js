import { Package } from "../package";
import { Allocation } from "../payment";
import { YagnaOptions } from "../executor";
import { DemandFactory } from "./factory";
import { Proposal } from "./proposal";
import { Logger, sleep, YagnaApi } from "../utils";
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

  /**
   * Determines the expiration time of the offer and the resulting activity in milliseconds.
   *
   * The value of this field is used to define how long the demand is valid for yagna to match against.
   * In addition, it will determine how long the resulting activity will be active.
   *
   * For example: if `expiration` is set to 10 minutes, the demand was created and starting an activity
   * required 2 minutes, this means that the activity will be running for 8 more minutes, and then will get terminated.
   *
   * **IMPORTANT**
   *
   * It is possible that a provider will reject engaging with that demand if it's configured  without using a deadline.
   *
   * **GUIDE**
   *
   * If your activity is about to operate for 5-30 min, {@link expirationSec} is sufficient.
   *
   * If your activity is about to operate for 30min-10h, {@link debitNotesAcceptanceTimeoutSec} should be set as well.
   *
   * If your activity is about to operate longer than 10h, you need set both {@link debitNotesAcceptanceTimeoutSec} and {@link midAgreementPaymentTimeoutSec}.
   */
  expirationSec?: number;

  logger?: Logger;
  maxOfferEvents?: number;

  offerFetchingIntervalSec?: number;

  proposalTimeout?: number;

  eventTarget?: EventTarget;

  /**
   * Maximum time for debit note acceptance (in seconds)
   *
   * If it would not be defined, the activities created for your demand would
   * probably live only 30 minutes, as that's the default value that the providers use to control engagements
   * that are not using mid-agreement payments.
   *
   * _Accepting debit notes during a long activity is considered a good practice in Golem Network._
   * The SDK will accept debit notes each 2 minutes.
   */
  debitNotesAcceptanceTimeoutSec?: number;

  /**
   * Maximum time to receive payment for any debit note. At the same time, the minimum interval between mid-agreement payments.
   *
   * Setting this is relevant in case activities which are running for a long time (like 10 hours and more). Providers control
   * the threshold activity duration for which they would like to enforce mid-agreement payments. This value depends on the
   * provider configuration. Checking proposal rejections from providers in yagna's logs can give you a hint about the
   * market expectations.
   *
   * _Paying in regular intervals for the computation resources is considered a good practice in Golem Network._
   * The SDK will issue payments each 12h by default, and you can control this with this setting.
   */
  midAgreementPaymentTimeoutSec?: number;
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
   *
   *  Note: it is an "atomic" operation.
   *  When the demand is created, the SDK will use it to subscribe for provider offer proposals matching it.
   *
   * @param taskPackage
   * @param allocation
   * @param yagnaApi
   * @param options
   *
   * @return Demand
   */
  static async create(
    taskPackage: Package,
    allocation: Allocation,
    yagnaApi: YagnaApi,
    options?: DemandOptions,
  ): Promise<Demand> {
    const factory = new DemandFactory(taskPackage, allocation, yagnaApi, options);
    return factory.create();
  }

  /**
   * @param id - demand ID
   * @param demandRequest - {@link DemandOfferBase}
   * @param yagnaApi - {@link YagnaApi}
   * @param options - {@link DemandConfig}
   * @hidden
   */
  constructor(
    public readonly id: string,
    private demandRequest: DemandOfferBase,
    private yagnaApi: YagnaApi,
    private options: DemandConfig,
  ) {
    super();
    this.logger = this.options.logger;
    this.subscribe().catch((e) => this.logger?.error(e));
  }

  /**
   * Stop subscribing for provider offer proposals for this demand
   */
  async unsubscribe() {
    this.isRunning = false;
    await this.yagnaApi.market.unsubscribeDemand(this.id);
    this.options.eventTarget?.dispatchEvent(new events.DemandUnsubscribed({ id: this.id }));
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
        const { data: events } = await this.yagnaApi.market.collectOffers(
          this.id,
          this.options.offerFetchingIntervalSec,
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
            this.yagnaApi.market,
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
