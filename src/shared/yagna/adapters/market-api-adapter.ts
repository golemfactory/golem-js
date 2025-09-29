import { Observable, switchMap } from "rxjs";
import {
  Agreement,
  AgreementEvent,
  AgreementState,
  Demand,
  DemandSpecification,
  GolemMarketError,
  IMarketApi,
  MarketErrorCode,
  MarketProposalEvent,
  OfferProposal,
} from "../../../market";
import { YagnaApi } from "../yagnaApi";
import { GolemInternalError, GolemUserError } from "../../error/golem-error";
import { createAbortSignalFromTimeout, Logger } from "../../utils";
import { DemandBodyPrototype, DemandPropertyValue, IDemandRepository } from "../../../market/demand";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";
import { withTimeout } from "../../utils/timeout";
import { AgreementOptions, IAgreementRepository } from "../../../market/agreement/agreement";
import { IProposalRepository, MarketProposal, OfferCounterProposal } from "../../../market/proposal";
import EventSource from "eventsource";
import { ScanSpecification, ScannedOffer } from "../../../market/scan";
import { cancelYagnaApiCall } from "../../utils/cancel";

/**
 * A bit more user-friendly type definition of DemandOfferBaseDTO from ya-ts-client
 *
 * That's probably one of the most confusing elements around Golem Protocol and the API specification:
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
  constructor(
    private readonly yagnaApi: YagnaApi,
    private readonly agreementRepo: IAgreementRepository,
    private readonly proposalRepo: IProposalRepository,
    private readonly demandRepo: IDemandRepository,
    private readonly logger: Logger,
  ) {}

  async publishDemandSpecification(spec: DemandSpecification): Promise<Demand> {
    const idOrError = await this.yagnaApi.market.subscribeDemand(this.buildDemandRequestBody(spec.prototype));

    if (typeof idOrError !== "string") {
      throw new Error(`Failed to subscribe to demand: ${idOrError.message}`);
    }

    const demand = new Demand(idOrError, spec);
    this.demandRepo.add(demand);

    return demand;
  }

  async unpublishDemand(demand: Demand): Promise<void> {
    const result = await this.yagnaApi.market.unsubscribeDemand(demand.id);

    if (result?.message) {
      throw new Error(`Failed to unsubscribe from demand: ${result.message}`);
    }
  }

  collectMarketProposalEvents(demand: Demand): Observable<MarketProposalEvent> {
    return new Observable((observer) => {
      let isCancelled = false;

      const longPoll = async () => {
        if (isCancelled) {
          return;
        }

        try {
          for (const event of await this.yagnaApi.market.collectOffers(demand.id)) {
            const timestamp = new Date(Date.parse(event.eventDate));

            switch (event.eventType) {
              case "ProposalEvent":
                {
                  try {
                    // @ts-expect-error FIXME #ya-ts-client, #ya-client: Fix mappings and type discriminators
                    const offerProposal = new OfferProposal(event.proposal, demand);
                    this.proposalRepo.add(offerProposal);
                    observer.next({
                      type: "ProposalReceived",
                      proposal: offerProposal,
                      timestamp,
                    });
                  } catch (err) {
                    observer.error(err);
                    this.logger.error("Failed to create offer proposal from the event", { err, event, demand });
                  }
                }
                break;
              case "ProposalRejectedEvent": {
                // @ts-expect-error FIXME #ya-ts-client, #ya-client: Fix mappings and type discriminators
                const { proposalId, reason } = event;

                const marketProposal = this.proposalRepo.getById(proposalId);

                if (marketProposal && this.isOfferCounterProposal(marketProposal)) {
                  observer.next({
                    type: "ProposalRejected",
                    counterProposal: marketProposal,
                    reason: reason.message,
                    timestamp,
                  });
                } else {
                  this.logger.error(
                    "Could not locate counter proposal with ID issued by the Requestor while handling ProposalRejectedEvent",
                    {
                      event,
                    },
                  );
                }
                break;
              }
              case "PropertyQueryEvent":
                observer.next({
                  type: "PropertyQueryReceived",
                  timestamp,
                });
                break;
              default:
                this.logger.warn("Unsupported demand subscription event", { event });
            }
          }
        } catch (error) {
          // when the demand is unsubscribed the long poll will reject with a 404
          if ("status" in error && error.status === 404) {
            return;
          }

          this.logger.error("Polling yagna for offer proposal events failed", error);
          observer.error(error);
        }

        void longPoll();
      };

      void longPoll();

      return () => {
        isCancelled = true;
      };
    });
  }

  async counterProposal(receivedProposal: OfferProposal, demand: DemandSpecification): Promise<OfferCounterProposal> {
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

    const dto = await this.yagnaApi.market.getProposalOffer(receivedProposal.demand.id, maybeNewId);

    const counterProposal = new OfferCounterProposal(dto);
    this.proposalRepo.add(counterProposal);
    return counterProposal;
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

  private buildDemandRequestBody(decorations: Partial<DemandBodyPrototype>): DemandRequestBody {
    let constraints: string;

    if (!decorations.constraints?.length) constraints = "(&)";
    else if (decorations.constraints.length == 1) constraints = decorations.constraints[0];
    else constraints = `(&${decorations.constraints.join("\n\t")})`;

    const properties: Record<string, DemandPropertyValue> = {};
    decorations.properties?.forEach((prop) => (properties[prop.key] = prop.value));

    return { constraints, properties };
  }

  public async getPaymentRelatedDemandDecorations(allocationId: string): Promise<DemandBodyPrototype> {
    return this.yagnaApi.payment.getDemandDecorations([allocationId]);
  }

  async confirmAgreement(
    agreement: Agreement,
    options?: AgreementOptions,
    signalOrTimeout?: AbortSignal | number,
  ): Promise<Agreement> {
    try {
      const signal = createAbortSignalFromTimeout(signalOrTimeout);
      // FIXME #yagna, If we don't provide the app-session ID when confirming the agreement, we won't be able to collect invoices with that app-session-id
      //   it's hard to know when the appSessionId is mandatory and when it isn't
      this.logger.debug("Confirming agreement by Requestor", { agreementId: agreement.id });
      await cancelYagnaApiCall(this.yagnaApi.market.confirmAgreement(agreement.id, this.yagnaApi.appSessionId), signal);
      this.logger.debug("Waiting for agreement approval by Provider", { agreementId: agreement.id });
      await cancelYagnaApiCall(
        this.yagnaApi.market.waitForApproval(agreement.id, options?.waitingForApprovalTimeoutSec || 60),
        signal,
      );
      this.logger.debug(`Agreement approved by Provider`, { agreementId: agreement.id });

      // Get fresh copy
      return this.agreementRepo.getById(agreement.id, signal);
    } catch (error) {
      throw new GolemMarketError(
        `Unable to confirm agreement with provider`,
        MarketErrorCode.AgreementApprovalFailed,
        error,
      );
    }
  }

  async createAgreement(
    proposal: OfferProposal,
    options?: AgreementOptions,
    signalOrTimeout: AbortSignal | number = 30_000,
  ): Promise<Agreement> {
    const expirationSec = options?.expirationSec || 3600;
    const signal = createAbortSignalFromTimeout(signalOrTimeout);

    try {
      const agreementProposalRequest = {
        proposalId: proposal.id,
        validTo: new Date(+new Date() + expirationSec * 1000).toISOString(),
      };

      const agreementId = await cancelYagnaApiCall(
        this.yagnaApi.market.createAgreement(agreementProposalRequest),
        signal,
      );

      if (typeof agreementId !== "string") {
        throw new GolemMarketError(
          `Unable to create agreement. Invalid response from the server`,
          MarketErrorCode.ResourceRentalCreationFailed,
        );
      }

      const agreement = await this.agreementRepo.getById(agreementId, signal);

      this.logger.debug(`Agreement created`, {
        agreement,
        proposalId: proposal.id,
        demandId: proposal.demand.id,
      });

      return agreement;
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemMarketError(
        `Unable to create agreement ${message}`,
        MarketErrorCode.ResourceRentalCreationFailed,
        error,
      );
    }
  }

  async proposeAgreement(
    proposal: OfferProposal,
    options?: AgreementOptions,
    signalOrTimeout?: AbortSignal | number,
  ): Promise<Agreement> {
    const agreement = await this.createAgreement(proposal, options, signalOrTimeout);
    const confirmed = await this.confirmAgreement(agreement, options, signalOrTimeout);
    const state = confirmed.getState();

    if (state !== "Approved") {
      throw new GolemMarketError(
        `Agreement ${agreement.id} cannot be approved. Current state: ${state}`,
        MarketErrorCode.AgreementApprovalFailed,
      );
    }

    this.logger.debug("Established agreement", agreement);

    return confirmed;
  }

  getAgreement(id: string, signalOrTimeout?: AbortSignal | number): Promise<Agreement> {
    return this.agreementRepo.getById(id, signalOrTimeout);
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
        this.yagnaApi.market.terminateAgreement(current.id, {
          message: reason,
        }),
        30000,
      );

      this.logger.debug(`Agreement terminated`, { id: agreement.id, reason });

      return this.agreementRepo.getById(agreement.id);
    } catch (error) {
      const message = getMessageFromApiError(error);
      throw new GolemMarketError(
        `Unable to terminate agreement ${agreement.id}. ${message}`,
        MarketErrorCode.ResourceRentalTerminationFailed,
        error,
      );
    }
  }

  public collectAgreementEvents(): Observable<AgreementEvent> {
    return this.yagnaApi.agreementEvents$.pipe(
      switchMap(
        (event) =>
          new Observable<AgreementEvent>((observer) => {
            try {
              this.logger.debug("Market API Adapter received agreement event", { event });

              const timestamp = new Date(Date.parse(event.eventDate));

              // @ts-expect-error FIXME #yagna, wasn't this fixed? {@issue https://github.com/golemfactory/yagna/pull/3136}
              const eventType = event.eventType || event.eventtype;

              this.getAgreement(event.agreementId)
                .then((agreement) => {
                  switch (eventType) {
                    case "AgreementApprovedEvent":
                      observer.next({
                        type: "AgreementApproved",
                        agreement,
                        timestamp,
                      });
                      break;
                    case "AgreementTerminatedEvent":
                      observer.next({
                        type: "AgreementTerminated",
                        agreement,
                        // @ts-expect-error FIXME #ya-ts-client event type discrimination doesn't work nicely with the current generator
                        terminatedBy: event.terminator,
                        // @ts-expect-error FIXME #ya-ts-client event type discrimination doesn't work nicely with the current generator
                        reason: event.reason.message,
                        timestamp,
                      });
                      break;
                    case "AgreementRejectedEvent":
                      observer.next({
                        type: "AgreementRejected",
                        agreement,
                        // @ts-expect-error FIXME #ya-ts-client event type discrimination doesn't work nicely with the current generator
                        reason: event.reason.message,
                        timestamp,
                      });
                      break;
                    case "AgreementCancelledEvent":
                      observer.next({
                        type: "AgreementCancelled",
                        agreement,
                        timestamp,
                      });
                      break;
                    default:
                      this.logger.warn("Unsupported agreement event type for event", { event });
                      break;
                  }
                })
                .catch((err) => this.logger.error("Failed to load agreement", { agreementId: event.agreementId, err }));
            } catch (err) {
              const golemMarketError = new GolemMarketError(
                "Error while processing agreement event from yagna",
                MarketErrorCode.InternalError,
                err,
              );
              this.logger.error(golemMarketError.message, { event, err });
              observer.error(err);
            }
          }),
      ),
    );
  }

  private isOfferCounterProposal(proposal: MarketProposal): proposal is OfferCounterProposal {
    return proposal.issuer === "Requestor";
  }

  public scan(spec: ScanSpecification): Observable<ScannedOffer> {
    const ac = new AbortController();
    return new Observable((observer) => {
      this.yagnaApi.market
        .beginScan({
          type: "offer",
          ...this.buildDemandRequestBody(spec),
        })
        .then((iterator) => {
          if (typeof iterator !== "string") {
            throw new Error(`Something went wrong while starting the scan, ${iterator.message}`);
          }
          return iterator;
        })
        .then(async (iterator) => {
          const cleanupIterator = () => this.yagnaApi.market.endScan(iterator);

          if (ac.signal.aborted) {
            await cleanupIterator();
            return;
          }

          const eventSource = new EventSource(
            `${this.yagnaApi.market.httpRequest.config.BASE}/scan/${iterator}/events`,
            {
              headers: {
                Accept: "text/event-stream",
                Authorization: `Bearer ${this.yagnaApi.yagnaOptions.apiKey}`,
              },
            },
          );

          eventSource.addEventListener("offer", (event) => {
            try {
              const parsed = JSON.parse(event.data);
              observer.next(new ScannedOffer(parsed));
            } catch (error) {
              observer.error(error);
            }
          });
          eventSource.addEventListener("error", (error) => observer.error(error));

          ac.signal.onabort = async () => {
            eventSource.close();
            await cleanupIterator();
          };
        })
        .catch((error) => {
          const message = getMessageFromApiError(error);
          observer.error(
            new GolemMarketError(`Error while scanning for offers. ${message}`, MarketErrorCode.ScanFailed, error),
          );
        });
      return () => {
        ac.abort();
      };
    });
  }
}
