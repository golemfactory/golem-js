import { Agreement, AgreementState, IAgreementApi, IAgreementEvents, IAgreementRepository } from "../../../market/agreement/agreement";
import { MarketApi } from "ya-ts-client";
import { GolemMarketError, MarketErrorCode, OfferProposal } from "../../../market";
import { withTimeout } from "../../utils/timeout";
import { Logger, YagnaApi } from "../../utils";
import { AgreementApiConfig } from "../../../market";
import { GolemUserError } from "../../error/golem-error";
import { getMessageFromApiError } from "../../utils/apiErrorMessage";
import { EventEmitter } from "eventemitter3";
import {
  AgreementCancelledEvent,
  AgreementConfirmedEvent,
  AgreementRejectedEvent,
  AgreementTerminatedEvent,
} from "../../../market/agreement/agreement-event";

export class AgreementApiAdapter implements IAgreementApi {
  public readonly events = new EventEmitter<IAgreementEvents>();

  private readonly api: MarketApi.RequestorService;

  constructor(
    private readonly appSessionId: string,
    private readonly yagnaApi: YagnaApi,
    private readonly repository: IAgreementRepository,
    private readonly logger: Logger,
    private readonly config = new AgreementApiConfig(),
  ) {
    this.api = this.yagnaApi.market;

    this.subscribeToAgreementEvents();
  }

  async confirmAgreement(agreement: Agreement): Promise<Agreement> {
    try {
      await this.api.confirmAgreement(agreement.id, this.appSessionId);
      await this.api.waitForApproval(agreement.id, this.config.agreementWaitingForApprovalTimeout);
      this.logger.debug(`Agreement approved`, { id: agreement.id });

      // Get fresh copy
      return this.repository.getById(agreement.id);
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
        this.api.createAgreement(agreementProposalRequest),
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

      return this.repository.getById(agreementId);
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
    return this.repository.getById(id);
  }

  async getAgreementState(id: string): Promise<AgreementState> {
    const entry = await this.repository.getById(id);
    return entry.getState();
  }

  async terminateAgreement(agreement: Agreement, reason: string = "Finished"): Promise<Agreement> {
    try {
      // Re-fetch entity before acting to be sure that we don't terminate a terminated activity
      const current = await this.repository.getById(agreement.id);

      if (current.getState() === "Terminated") {
        throw new GolemUserError("You can not terminate an agreement that's already terminated");
      }

      await withTimeout(
        this.api.terminateAgreement(current.id, {
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

      return this.repository.getById(agreement.id);
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
      error: (err) => this.logger.error("Agreement API event subscription error", err),
      next: async (event) => {
        // This looks like adapter logic!
        try {
          const eventDate = new Date(Date.parse(event.eventDate));

          // @ts-expect-error FIXME #yagna, wasn't this fixed? {@issue https://github.com/golemfactory/yagna/pull/3136}
          const eventType = event.eventType || event.eventtype;

          const agreement = await this.getAgreement(event.agreementId);

          this.logger.debug("Agreement API received agreement event", { event });

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
      complete: () => this.logger.info("Market Module completed subscribing agreement events"),
    });
  }
}
