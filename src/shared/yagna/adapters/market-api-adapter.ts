import { Observable, Subject } from "rxjs";
import {
  Agreement,
  AgreementState,
  Demand,
  DemandSpecification,
  GolemMarketError,
  IMarketApi,
  IMarketEvents,
  MarketApiConfig,
  MarketErrorCode,
  OfferProposal,
  OfferSubscriptionEvents,
  YagnaProposalEvent,
} from "../../../market";
import { YagnaApi } from "../yagnaApi";
import YaTsClient, { MarketApi } from "ya-ts-client";
import { GolemInternalError, GolemUserError } from "../../error/golem-error";
import { Logger } from "../../utils";
import { DemandBodyPrototype, DemandPropertyValue } from "../../../market/demand/demand-body-builder";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";
import { EventEmitter } from "eventemitter3";
import { withTimeout } from "../../utils/timeout";
import { IAgreementRepository } from "../../../market/agreement/agreement";
import {
  AgreementCancelledEvent,
  AgreementConfirmedEvent,
  AgreementRejectedEvent,
  AgreementTerminatedEvent,
} from "../../../market/agreement/agreement-event";

/**
 * A bit more user-friendly type definition of DemandOfferBaseDTO from ya-ts-client
 *
 * That's probably one of the most confusing elements around Golem Protocol and the API specificiation:
 *
 * - Providers create Offers
 * - Requestors create Demands
 * - Demands are used to create a subscription for Proposals - Initial ones reflect the Offer that was matched with the Demand used to subscribe
 * - Once the proposal is countered, it's countered with a "counter proposal" which is no longer Offer + Demand,
 *   but rather a sketch of the agreement - here both parties try to agree on the values of certain properties that
 *   are interesting from their perspective. These "negotiated proposals (of) ...." are buit using DemandOffeBaseDTO
 *
 * #FIXME yagna - feedback in the note above
 */
export type DemandRequestBody = {
  properties: Record<string, string | number | boolean | string[] | number[]>;
  constraints: string;
};

export class MarketApiAdapter implements IMarketApi {
  public readonly events = new EventEmitter<IMarketEvents>();

  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly agreementRepo: IAgreementRepository,
    private readonly logger: Logger,
    private readonly config: MarketApiConfig = new MarketApiConfig(),
  ) {
    this.subscribeToAgreementEvents();
  }

  async publishDemandSpecification(spec: DemandSpecification): Promise<Demand> {
    const idOrError = await this.yagnaApi.market.subscribeDemand(this.buildDemandRequestBody(spec.prototype));

    if (typeof idOrError !== "string") {
      throw new Error(`Failed to subscribe to demand: ${idOrError.message}`);
    }

    const demand = new Demand(idOrError, spec);

    this.events.emit("subscribedToOfferProposals", demand);

    return demand;
  }

  async unpublishDemand(demand: Demand): Promise<void> {
    const result = await this.yagnaApi.market.unsubscribeDemand(demand.id);

    if (result?.message) {
      throw new Error(`Failed to unsubscribe from demand: ${result.message}`);
    }

    this.events.emit("unsubscribedFromOfferProposals", demand);
  }

  observeProposalEvents(demand: Demand): Observable<YagnaProposalEvent> {
    return new Observable<YagnaProposalEvent>((subscriber) => {
      let offerProposalEvents: YaTsClient.MarketApi.CancelablePromise<YagnaProposalEvent[]>;
      let isCancelled = false;
      const longPoll = async () => {
        if (isCancelled) {
          return;
        }
        try {
          offerProposalEvents = this.yagnaApi.market.collectOffers(demand.id) as YaTsClient.MarketApi.CancelablePromise<
            YagnaProposalEvent[]
          >;
          const proposals = await offerProposalEvents;
          for (const proposal of proposals) {
            subscriber.next(proposal);
          }
        } catch (error) {
          if (error instanceof YaTsClient.MarketApi.CancelError) {
            return;
          }
          // when the demand is unsubscribed the long poll will reject with a 404
          if ("status" in error && error.status === 404) {
            return;
          }
          subscriber.error(error);
        }

        longPoll().catch((err) => subscriber.error(err));
      };

      longPoll().catch((err) => subscriber.error(err));

      return () => {
        isCancelled = true;
        offerProposalEvents.cancel();
      };
    });
  }

  observeDemandResponse(demand: Demand) {
    const initialOfferProposals$ = new Subject<OfferProposal>();
    const draftOfferProposals$ = new Subject<OfferProposal>();
    const events = new EventEmitter<OfferSubscriptionEvents>();

    let isCancelled = false;

    const longPoll = async () => {
      if (isCancelled) {
        return;
      }

      try {
        for await (const event of await this.yagnaApi.market.collectOffers(demand.id)) {
          switch (event.eventType) {
            case "ProposalEvent":
              {
                try {
                  // @ts-expect-error FIXME #ya-ts-client, #ya-client: Fix mappings and type discriminators
                  const offerProposal = new OfferProposal(event.proposal, demand);

                  if (offerProposal.isInitial()) {
                    initialOfferProposals$.next(offerProposal);
                    events.emit("initialOfferProposalReceived", offerProposal);
                  } else if (offerProposal.isDraft()) {
                    draftOfferProposals$.next(offerProposal);
                    events.emit("draftOfferProposalReceived", offerProposal);
                  } else {
                    this.logger.warn("Received proposal event that's not supported (not Initial or Draft)", { event });
                  }
                } catch (err) {
                  this.logger.error("Failed to create offer proposal from the event", { err, event, demand });
                }
              }
              break;
            case "ProposalRejectedEvent":
              events.emit("counterProposalRejected");
              break;
            case "PropertyQueryEvent":
              events.emit("propertyQueryReceived");
              break;
            default:
              this.logger.warn("Unsupported demand subscription event", { event });
          }
        }
      } catch (error) {
        if (error instanceof YaTsClient.MarketApi.CancelError) {
          return;
        }

        // when the demand is unsubscribed the long poll will reject with a 404
        if ("status" in error && error.status === 404) {
          return;
        }

        this.logger.error("Polling yagna for offer proposal events failed", error);
      }

      void longPoll();
    };

    void longPoll();

    const cancel = () => {
      isCancelled = true;
    };

    return {
      initialOfferProposals$,
      draftOfferProposals$,
      events,
      cancel,
    };
  }

  async counterProposal(receivedProposal: OfferProposal, demand: DemandSpecification): Promise<void> {
    const bodyClone = structuredClone(this.buildDemandRequestBody(demand.prototype));

    bodyClone.properties["golem.com.payment.chosen-platform"] = demand.paymentPlatform;

    const maybeNewId = await this.yagnaApi.market.counterProposalDemand(
      receivedProposal.demand.id,
      receivedProposal.id,
      bodyClone,
    );

    this.logger.debug("Proposal counter result from yagna", { result: maybeNewId });

    if (typeof maybeNewId !== "string") {
      throw new GolemInternalError(`Counter proposal failed ${maybeNewId.message}`);
    }
  }

  async rejectProposal(receivedProposal: OfferProposal, reason: string): Promise<void> {
    try {
      const result = await this.yagnaApi.market.rejectProposalOffer(receivedProposal.demand.id, receivedProposal.id, {
        message: reason,
      });

      this.logger.debug("Proposal rejection result from yagna", { response: result });
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemMarketError(
        `Failed to reject proposal. ${message}`,
        MarketErrorCode.ProposalRejectionFailed,
        error,
      );
    }
  }

  private buildDemandRequestBody(decorations: DemandBodyPrototype): DemandRequestBody {
    let constraints: string;

    if (!decorations.constraints.length) constraints = "(&)";
    else if (decorations.constraints.length == 1) constraints = decorations.constraints[0];
    else constraints = `(&${decorations.constraints.join("\n\t")})`;

    const properties: Record<string, DemandPropertyValue> = {};
    decorations.properties.forEach((prop) => (properties[prop.key] = prop.value));

    return { constraints, properties };
  }

  public async getPaymentRelatedDemandDecorations(allocationId: string): Promise<DemandBodyPrototype> {
    return this.yagnaApi.payment.getDemandDecorations([allocationId]);
  }

  async confirmAgreement(agreement: Agreement): Promise<Agreement> {
    try {
      // FIXME #yagna, If we don't provide the app-session ID when confirming the agreement, we won't be able to collect invoices with that app-session-id
      //   it's hard to know when the appSessionId is mandatory and when it isn't
      await this.yagnaApi.market.confirmAgreement(agreement.id, this.yagnaApi.appSessionId);
      await this.yagnaApi.market.waitForApproval(agreement.id, this.config.agreementWaitingForApprovalTimeout);
      this.logger.debug(`Agreement approved`, { id: agreement.id });

      // Get fresh copy
      return this.agreementRepo.getById(agreement.id);
      // this.events.emit("confirmed", { id: this.id, provider: this.getProviderInfo() });
    } catch (error) {
      // this.events.emit("rejected", {
      //   id: this.id,
      //   provider: this.getProviderInfo(),
      //   reason: error.toString(),
      // });
      throw new GolemMarketError(
        `Unable to confirm agreement with provider`,
        MarketErrorCode.AgreementApprovalFailed,
        error,
      );
    }
  }

  async createAgreement(proposal: OfferProposal): Promise<Agreement> {
    try {
      const agreementProposalRequest = {
        proposalId: proposal.id,
        validTo: new Date(+new Date() + 3600 * 1000).toISOString(),
      };

      const agreementId = await withTimeout(
        this.yagnaApi.market.createAgreement(agreementProposalRequest),
        this.config.agreementRequestTimeout,
      );

      if (typeof agreementId !== "string") {
        throw new GolemMarketError(
          `Unable to create agreement. Invalid response from the server`,
          MarketErrorCode.LeaseProcessCreationFailed,
        );
      }

      this.logger.debug(`Agreement created`, {
        agreementId: agreementId,
        proposalId: proposal.id,
        demandId: proposal.demand.id,
      });

      // TODO - do we need it?
      // this.events.emit("agreementCreated", {
      //   id: agreementId,
      //   provider: "todo",
      //   validTo: data?.validTo,
      //   proposalId: proposal.id,
      // });

      return this.agreementRepo.getById(agreementId);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemMarketError(
        `Unable to create agreement ${message}`,
        MarketErrorCode.LeaseProcessCreationFailed,
        error,
      );
    }
  }

  async proposeAgreement(proposal: OfferProposal): Promise<Agreement> {
    const agreement = await this.createAgreement(proposal);
    const confirmed = await this.confirmAgreement(agreement);
    const state = confirmed.getState();

    if (state !== "Approved") {
      throw new GolemMarketError(
        `Agreement ${agreement.id} cannot be approved. Current state: ${state}`,
        MarketErrorCode.AgreementApprovalFailed,
      );
    }

    this.logger.info("Established agreement", { agreementId: agreement.id, provider: agreement.getProviderInfo() });

    return confirmed;
  }

  getAgreement(id: string): Promise<Agreement> {
    return this.agreementRepo.getById(id);
  }

  async getAgreementState(id: string): Promise<AgreementState> {
    const entry = await this.agreementRepo.getById(id);
    return entry.getState();
  }

  async terminateAgreement(agreement: Agreement, reason: string = "Finished"): Promise<Agreement> {
    try {
      // Re-fetch entity before acting to be sure that we don't terminate a terminated activity
      const current = await this.agreementRepo.getById(agreement.id);

      if (current.getState() === "Terminated") {
        throw new GolemUserError("You can not terminate an agreement that's already terminated");
      }

      await withTimeout(
        // TODO: Make a fix in ya-ts-client typings so that's going to be specifically {message:string}
        this.yagnaApi.market.terminateAgreement(current.id, {
          message: reason,
        }),
        this.config.agreementRequestTimeout,
      );

      // this.events.emit("terminated", {
      //   id: this.id,
      //   provider: this.getProviderInfo(),
      //   reason: reason,
      // });

      this.logger.debug(`Agreement terminated`, { id: agreement.id, reason });

      return this.agreementRepo.getById(agreement.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemMarketError(
        `Unable to terminate agreement ${agreement.id}. ${message}`,
        MarketErrorCode.LeaseProcessTerminationFailed,
        error,
      );
    }
  }

  private subscribeToAgreementEvents() {
    return this.yagnaApi.agreementEvents$.subscribe({
      error: (err) => this.logger.error("Market API event subscription error", err),
      next: async (event) => {
        // This looks like adapter logic!
        try {
          const eventDate = new Date(Date.parse(event.eventDate));

          // @ts-expect-error FIXME #yagna, wasn't this fixed? {@issue https://github.com/golemfactory/yagna/pull/3136}
          const eventType = event.eventType || event.eventtype;

          const agreement = await this.getAgreement(event.agreementId);

          this.logger.debug("Market API received agreement event", { event });

          switch (eventType) {
            case "AgreementApprovedEvent":
              this.events.emit("agreementConfirmed", new AgreementConfirmedEvent(agreement, eventDate));
              break;
            case "AgreementTerminatedEvent":
              this.events.emit(
                "agreementTerminated",
                // @ts-expect-error FIXME #ya-ts-client event type discrimination doesn't work nicely with the current generator
                new AgreementTerminatedEvent(agreement, eventDate, event.terminator, event.reason.message),
              );
              break;
            case "AgreementRejectedEvent":
              this.events.emit(
                "agreementRejected",
                // @ts-expect-error FIXME #ya-ts-client event type discrimination doesn't work nicely with the current generator
                new AgreementRejectedEvent(agreement, eventDate, event.reason.message),
              );
              break;
            case "AgreementCancelledEvent":
              this.events.emit("agreementCancelled", new AgreementCancelledEvent(agreement, eventDate));
              break;
            default:
              this.logger.warn("Unsupported agreement event type for event", { event });
              break;
          }
        } catch (err) {
          const golemMarketError = new GolemMarketError(
            "Error while processing agreement event from yagna",
            MarketErrorCode.InternalError,
            err,
          );
          this.logger.error(golemMarketError.message, { event, err });
        }
      },
      complete: () => this.logger.info("Market API completed subscribing agreement events"),
    });
  }
}
