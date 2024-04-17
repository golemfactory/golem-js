/* eslint-disable @typescript-eslint/no-unused-vars */
import { EventEmitter } from "eventemitter3";
import { DemandConfig, DemandNew, DemandOptions, ProposalFilter } from "./index";
import { Demand, GolemMarketError, MarketErrorCode, Proposal, ProposalFilter } from "./index";
import { Agreement, AgreementOptions } from "../agreement";

import { YagnaApi } from "../shared/utils";
import { switchMap, Observable, filter, bufferCount, tap } from "rxjs";
import { MarketApi } from "ya-ts-client";
import { Allocation, PaymentModule } from "../payment";
import { ProposalNew } from "./proposal";
import { Package } from "./package";
import { DecorationsBuilder } from "./builder";
import { ProposalFilterNew } from "./service";

export interface MarketEvents {}

export interface DemandBuildParams {
  demand: DemandOptions;
  market: MarketOptions;
}

/**
 * -----*----*-----X----*-----X-----*
 *
 * const final = await sub.waitFor((p) => p.paretnId == 123);
 */
export interface Resources {
  /** The minimum CPU requirement for each service instance. */
  minCpu?: number;
  /* The minimum memory requirement (in Gibibyte) for each service instance. */
  minMemGib?: number;
  /** The minimum storage requirement (in Gibibyte) for each service instance. */
  minStorageGib?: number;
}

export interface MarketOptions {
  /** How long you want to rent the resources in hours */
  rentHours?: number;

  pricing?: {
    maxStartPrice: number;
    maxCpuPerHourPrice: number;
    maxEnvPerHourPrice: number;
  };

  /** The payment network that should be considered while looking for providers and where payments will be done */
  paymentNetwork?: string;

  /**
   * List of provider Golem Node IDs that should be considered
   *
   * If not provided, the list will be pulled from: https://provider-health.golem.network/v1/provider-whitelist
   */
  withProviders?: string[];
  withoutProviders?: string[];
  withOperators?: string[];
  withoutOperators?: string[];
}

export interface MarketModule {
  events: EventEmitter<MarketEvents>;

  buildDemand(
    taskPackage: Package,
    allocation: Allocation,
    options: DemandOptions,
  ): Promise<MarketApi.DemandOfferBaseDTO>;

  /**
   * Publishes the demand to the market and handles refreshing it when needed.
   * Each time the demand is refreshed, a new demand is emitted by the observable.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   * Unsubscribing will remove the demand from the market.
   */
  publishDemand(offer: MarketApi.DemandOfferBaseDTO, expiration: number): Observable<DemandNew>;

  /**
   * Subscribes to the proposals for the given demand.
   * If an error occurs, the observable will emit an error and complete.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   */
  subscribeForProposals(demand: DemandNew): Observable<ProposalNew>;

  /**
   * Sends a counter-offer to the provider. Note that to get the provider's response to your
   * counter you should listen to proposals sent to yagna using `subscribeForProposals`.
   */
  negotiateProposal(
    receivedProposal: ProposalNew,
    offer: MarketApi.DemandOfferBaseDTO,
    paymentPlatform: string,
  ): Promise<ProposalNew>;

  /**
   * Internally
   *
   * - ya-ts-client createAgreement
   * - ya-ts-client approveAgreement
   * - ya-ts-client "wait for approval"
   *
   * @param paymentModule
   * @param proposal
   * @param options
   *
   * @return Returns when the provider accepts the agreement, rejects otherwise. The resulting agreement is ready to create activities from.
   */
  proposeAgreement(paymentModule: PaymentModule, proposal: ProposalNew, options?: AgreementOptions): Promise<Agreement>;

  /**
   *
   * @return The Agreement that has been terminated via Yagna
   */
  terminateAgreement(agreement: Agreement, reason?: string): Promise<Agreement>;

  /**
   * Helper method that will allow reaching an agreement for the user without dealing with manual labour of demand/subscription
   */
  getAgreement(options: MarketOptions, filter: ProposalFilter): Promise<Agreement>;

  getAgreements(options: MarketOptions, filter: ProposalFilter, count: number): Promise<Agreement[]>;

  /**
   * Creates a demand for the given package and allocation and starts collecting, filtering and negotiating proposals.
   * The method returns an observable that emits a batch of draft proposals every time the buffer is full.
   * The method will automatically negotiate the proposals until they are moved to the `Draft` state.
   * Keep in mind that since this method returns an observable, nothing will happen until you subscribe to it.
   * Unsubscribing from the observable will stop the process and remove the demand from the market.
   */
  startCollectingProposals(options: {
    demandOffer: MarketApi.DemandOfferBaseDTO;
    paymentPlatform: string;
    demandOptions?: DemandOptions;
    filter?: ProposalFilterNew;
    bufferSize?: number;
  }): Observable<ProposalNew[]>;
}

type ProposalEvent = MarketApi.ProposalEventDTO & MarketApi.ProposalRejectedEventDTO;

export class MarketModuleImpl implements MarketModule {
  events: EventEmitter<MarketEvents> = new EventEmitter<MarketEvents>();

  constructor(private readonly yagnaApi: YagnaApi) {}

  async buildDemand(
    taskPackage: Package,
    allocation: Allocation,
    options: DemandOptions,
  ): Promise<MarketApi.DemandOfferBaseDTO> {
    const config = new DemandConfig(options);
    const builder = new DecorationsBuilder();

    const taskDecorations = await taskPackage.getDemandDecoration();
    const allocationDecoration = await allocation.getDemandDecoration();

    builder.addDecorations([taskDecorations, allocationDecoration]);

    // Configure basic properties
    builder
      .addProperty("golem.srv.caps.multi-activity", true)
      .addProperty("golem.srv.comp.expiration", Date.now() + config.expirationSec * 1000)
      .addProperty("golem.node.debug.subnet", config.subnetTag)
      .addProperty("golem.com.payment.debit-notes.accept-timeout?", config.debitNotesAcceptanceTimeoutSec)
      .addConstraint("golem.com.pricing.model", "linear")
      .addConstraint("golem.node.debug.subnet", config.subnetTag);

    // Configure mid-agreement payments
    builder
      .addProperty("golem.com.scheme.payu.debit-note.interval-sec?", config.midAgreementDebitNoteIntervalSec)
      .addProperty("golem.com.scheme.payu.payment-timeout-sec?", config.midAgreementPaymentTimeoutSec);

    return builder.getDemandRequest();
  }

  publishDemand(offer: MarketApi.DemandOfferBaseDTO, expiration: number = 60 * 60 * 1000): Observable<DemandNew> {
    return new Observable<DemandNew>((subscriber) => {
      let id: string;

      const subscribeDemand = async () => {
        const idOrError = await this.yagnaApi.market.subscribeDemand(offer);
        if (typeof idOrError !== "string") {
          subscriber.error(new Error(`Failed to subscribe to demand: ${idOrError}`));
          return;
        }
        id = idOrError;
        subscriber.next(new DemandNew(id, offer));
      };
      subscribeDemand();

      const interval = setInterval(() => {
        this.yagnaApi.market.unsubscribeDemand(id);
        subscribeDemand();
      }, expiration);

      return () => {
        clearInterval(interval);
        this.yagnaApi.market.unsubscribeDemand(id);
      };
    });
  }

  subscribeForProposals(demand: DemandNew): Observable<ProposalNew> {
    return new Observable<ProposalNew>((subscriber) => {
      let proposalPromise: MarketApi.CancelablePromise<ProposalEvent[]>;
      let isCancelled = false;
      const longPoll = async () => {
        if (isCancelled) {
          return;
        }
        try {
          proposalPromise = this.yagnaApi.market.collectOffers(demand.id) as MarketApi.CancelablePromise<
            ProposalEvent[]
          >;
          const proposals = await proposalPromise;
          const successfulProposals = proposals.filter((proposal) => !proposal.reason);
          successfulProposals.forEach((proposal) => subscriber.next(new ProposalNew(proposal.proposal, demand)));
        } catch (error) {
          if (error instanceof MarketApi.CancelError) {
            return;
          }
          // when the demand is unsubscribed the long poll will reject with a 404
          if ("status" in error && error.status === 404) {
            return;
          }
          subscriber.error(error);
        }
        longPoll();
      };
      longPoll();
      return () => {
        isCancelled = true;
        proposalPromise.cancel();
      };
    });
  }

  async negotiateProposal(
    receivedProposal: ProposalNew,
    offer: MarketApi.DemandOfferBaseDTO,
    paymentPlatform: string,
  ): Promise<ProposalNew> {
    const offerClone = structuredClone(offer);
    offerClone.properties["golem.com.payment.chosen-platform"] = paymentPlatform;

    const newProposalId = await this.yagnaApi.market.counterProposalDemand(
      receivedProposal.demand.id,
      receivedProposal.id,
      offerClone,
    );

    if (typeof newProposalId !== "string") {
      throw new Error(`Failed to create counter-offer ${newProposalId}`);
    }
    const proposalModel = await this.yagnaApi.market.getProposalOffer(receivedProposal.demand.id, newProposalId);
    return new ProposalNew(proposalModel, receivedProposal.demand);
  }

  async proposeAgreement(
    paymentModule: PaymentModule,
    proposal: ProposalNew,
    options?: AgreementOptions,
  ): Promise<Agreement> {
    const agreement = await Agreement.create(proposal, this.yagnaApi, options);
    await agreement.confirm(this.yagnaApi.appSessionId);
    await this.yagnaApi.market.waitForApproval(agreement.id, 60);
    const state = await agreement.getState();
    if (state !== "Approved") {
      throw new GolemMarketError(
        `Agreement ${agreement.id} cannot be approved. Current state: ${state}`,
        MarketErrorCode.AgreementApprovalFailed,
        agreement.proposal.demand,
      );
    }
    return agreement;
  }

  terminateAgreement(agreement: Agreement, reason: string): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  getAgreement(options: MarketOptions, filter: ProposalFilter): Promise<Agreement> {
    throw new Error("Method not implemented.");
  }

  getAgreements(options: MarketOptions, filter: ProposalFilter, count: number): Promise<Agreement[]> {
    throw new Error("Method not implemented.");
  }

  startCollectingProposals(options: {
    demandOffer: MarketApi.DemandOfferBaseDTO;
    paymentPlatform: string;
    demandOptions?: DemandOptions;
    filter?: ProposalFilterNew;
    bufferSize?: number;
  }): Observable<ProposalNew[]> {
    return this.publishDemand(options.demandOffer, options.demandOptions?.expirationSec).pipe(
      // for each demand created -> start collecting all proposals
      switchMap((demand) => this.subscribeForProposals(demand)),
      // for each proposal collected -> filter out undesired and invalid ones
      filter((proposal) => proposal.isValid()),
      filter((proposal) => !options.filter || options.filter(proposal)),
      // for each valid proposal -> start negotiating if it's not in draft state yet
      tap((proposal) => {
        if (proposal.isInitial()) {
          this.negotiateProposal(proposal, options.demandOffer, options.paymentPlatform);
        }
      }),
      // for each proposal -> filter out all states other than draft
      filter((proposal) => proposal.isDraft()),
      // for each draft proposal -> add them to the buffer
      bufferCount(options.bufferSize || 50),
    );
  }
}
